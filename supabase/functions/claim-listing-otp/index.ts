/**
 * claim-listing-otp/index.ts
 * Supabase Edge Function — sends and verifies SMS OTPs for listing claims.
 *
 * This is separate from send-verification-code / verify-code (which require
 * the caller to already own the listing). This function works on unclaimed
 * listings and transfers ownership on successful verification.
 *
 * POST /functions/v1/claim-listing-otp
 * Authorization: Bearer <user JWT>
 *
 * Send:
 *   Body: { action: "send", listingId, listingType: "practitioner"|"center" }
 *   → Sends a 6-digit SMS to the listing's phone number
 *   → Returns: { maskedPhone, expiresInSeconds }
 *
 * Verify:
 *   Body: { action: "verify", listingId, listingType, code: "123456" }
 *   → Verifies the code and claims the listing
 *   → Returns: { success: true }
 *
 * Deploy:
 *   supabase functions deploy claim-listing-otp --no-verify-jwt
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (auto-set)
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64Encode } from 'https://deno.land/std@0.208.0/encoding/base64.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const TWILIO_SID   = Deno.env.get('TWILIO_ACCOUNT_SID')  ?? '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')    ?? '';
const TWILIO_FROM  = Deno.env.get('TWILIO_FROM_NUMBER')   ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function generateCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1_000_000).padStart(6, '0');
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

function maskPhone(e164: string): string {
  // +1XXXXXXXXXX → +1 *** ***1234
  return e164.replace(/(\+\d{1})(\d{3})(\d{3})(\d{4})/, '$1 *** ***$4');
}

async function sendSms(to: string, body: string): Promise<void> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    throw new Error('Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in Edge Function env vars.');
  }
  const auth = base64Encode(`${TWILIO_SID}:${TWILIO_TOKEN}`);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Twilio error ${res.status}: ${(err as any).message ?? res.statusText}`);
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  try {
    // Auth
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const { action, listingId, listingType, code } = body;

    if (!listingId || !listingType) return json({ error: 'Missing listingId or listingType' }, 400);
    if (!['practitioner', 'center'].includes(listingType)) return json({ error: 'Invalid listingType' }, 400);

    const table = listingType === 'practitioner' ? 'practitioners' : 'centers';

    // Fetch listing — must be unclaimed
    const { data: listing, error: listErr } = await supabase
      .from(table)
      .select('id, name, phone, owner_id')
      .eq('id', listingId)
      .single();

    if (listErr || !listing) return json({ error: 'Listing not found' }, 404);
    if (listing.owner_id)    return json({ error: 'This listing has already been claimed.' }, 409);

    // ── SEND ─────────────────────────────────────────────────────────────────
    if (action === 'send') {
      if (!listing.phone) return json({ error: 'No phone number on this listing.' }, 400);

      const phone = normalizePhone(listing.phone);
      if (!phone) return json({ error: 'Invalid phone number format on listing.' }, 400);

      // Rate limit: max 5 sends per listing per hour
      const { count } = await supabase
        .from('claim_sms_otps')
        .select('id', { count: 'exact', head: true })
        .eq('listing_id', listingId)
        .eq('listing_type', listingType)
        .gte('created_at', new Date(Date.now() - 3600_000).toISOString());

      if ((count ?? 0) >= 5) {
        return json({ error: 'Too many attempts. Please try again in an hour.' }, 429);
      }

      // Expire any existing codes for this listing
      await supabase
        .from('claim_sms_otps')
        .delete()
        .eq('listing_id', listingId)
        .eq('listing_type', listingType);

      // Generate + store new code
      const rawCode  = generateCode();
      const codeHash = await sha256(rawCode);

      const { error: insertErr } = await supabase.from('claim_sms_otps').insert({
        listing_id:   listingId,
        listing_type: listingType,
        code_hash:    codeHash,
      });
      if (insertErr) return json({ error: 'Failed to create verification code.' }, 500);

      // Send SMS
      await sendSms(phone, `Your Hawaii Wellness claim code is: ${rawCode}. It expires in 10 minutes.`);

      return json({ success: true, maskedPhone: maskPhone(phone), expiresInSeconds: 600 });
    }

    // ── VERIFY ────────────────────────────────────────────────────────────────
    if (action === 'verify') {
      if (!code || !/^\d{6}$/.test(code)) return json({ error: 'Code must be 6 digits.' }, 400);

      const codeHash = await sha256(code);

      // Find valid, unexpired code
      const { data: otpRow, error: otpErr } = await supabase
        .from('claim_sms_otps')
        .select('id, attempts, expires_at')
        .eq('listing_id',   listingId)
        .eq('listing_type', listingType)
        .eq('code_hash',    codeHash)
        .gt('expires_at',   new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (otpErr || !otpRow) {
        // Increment attempts on the most recent OTP (lockout after 5 wrong guesses)
        await supabase.rpc('increment_claim_otp_attempts', {
          p_listing_id:   listingId,
          p_listing_type: listingType,
        }).catch(() => {/* ignore */});

        return json({ error: 'Invalid or expired code. Please request a new one.' }, 400);
      }

      // Guard against brute-force
      if (otpRow.attempts >= 5) {
        await supabase.from('claim_sms_otps').delete().eq('id', otpRow.id);
        return json({ error: 'Too many incorrect attempts. Please request a new code.' }, 400);
      }

      // Delete OTP BEFORE claiming — prevents reuse if the claim call
      // fails transiently, since a consumed code must never be retried.
      await supabase.from('claim_sms_otps').delete().eq('id', otpRow.id);

      // Claim the listing via the appropriate RPC.
      // Called as service role with explicit user ID since auth.uid()
      // is not the claiming user in a service-role context.
      const rpcName = listingType === 'center' ? 'claim_listing_center_sms' : 'claim_listing_sms';
      const { error: claimErr } = await supabase.rpc(rpcName, {
        p_listing_id: listingId,
        p_user_id:    user.id,
      });

      if (claimErr) {
        return json({ error: claimErr.message.includes('claim_failed')
          ? 'This listing is already claimed or could not be found.'
          : claimErr.message
        }, 400);
      }

      return json({ success: true });
    }

    return json({ error: 'Invalid action. Use "send" or "verify".' }, 400);

  } catch (err) {
    console.error('[claim-listing-otp]', err);
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
