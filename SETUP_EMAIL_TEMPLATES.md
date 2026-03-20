# Email Template Configuration for Claim Verification

## Overview

When providers verify their listing via email OTP, Supabase Auth sends an email from `aloha@hawaiiwellness.net`. By default, the email only shows the Supabase magic link token, not your 6-digit code.

To show your code prominently, customize the Supabase email template.

## Steps

### 1. Open Supabase Dashboard

1. Navigate to your Supabase project: https://app.supabase.com
2. Go to **Auth** → **Email Templates**

### 2. Edit the Magic Link Template

1. Click on **"Magic Link"** template (the one used for OTP emails)
2. Click the **Edit** button

### 3. Replace with Custom Template

Replace the entire template body with:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background: #f8f9fa;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 32px;
      text-align: center;
    }
    .header {
      margin-bottom: 24px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
    }
    .code-box {
      background: #f0f0f0;
      border: 2px solid #ddd;
      border-radius: 8px;
      padding: 24px;
      margin: 24px 0;
    }
    .code {
      font-size: 48px;
      font-weight: bold;
      letter-spacing: 8px;
      color: #000;
      font-family: "Courier New", monospace;
    }
    .expiry {
      color: #666;
      font-size: 14px;
      margin-top: 16px;
    }
    .footer {
      border-top: 1px solid #eee;
      margin-top: 24px;
      padding-top: 16px;
      font-size: 12px;
      color: #999;
    }
    .security {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 12px;
      margin: 16px 0;
      border-radius: 4px;
      font-size: 13px;
      color: #856404;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>Verify Your Listing</h1>
        <p style="color: #666; font-size: 16px; margin: 8px 0 0 0;">{{ .Data.listing_name }}</p>
      </div>

      <p style="margin-bottom: 24px; font-size: 16px;">
        Use this code to verify your listing on Aloha Health Hub:
      </p>

      <div class="code-box">
        <div class="code">{{ .Data.verification_code }}</div>
        <div class="expiry">This code expires in 10 minutes</div>
      </div>

      <div class="security">
        <strong>🔒 Security Notice:</strong> If you didn't request this code, please ignore this email. Do not share this code with anyone.
      </div>

      <p style="margin-bottom: 0; font-size: 14px; color: #666;">
        Questions? Contact us at <a href="mailto:aloha@hawaiiwellness.net" style="color: #0066cc;">aloha@hawaiiwellness.net</a>
      </p>

      <div class="footer">
        <p style="margin: 8px 0;">© 2026 Aloha Health Hub. All rights reserved.</p>
        <p style="margin: 8px 0;">hawaiiwellness.net</p>
      </div>
    </div>
  </div>
</body>
</html>
```

### 4. Save and Test

1. Click **"Save"** button
2. Go to your app and trigger a claim verification
3. Check the email you receive — it should prominently display the 6-digit code

### 5. Customize Further (Optional)

You can customize the template further:
- Replace `{{ .Data.listing_name }}` with your business name
- Adjust colors to match your brand
- Add a logo by replacing the header
- Change the footer text

## Key Template Variables

When `send-verification-code` edge function calls Supabase Auth, it passes these data fields:

| Variable | Value | Usage |
|----------|-------|-------|
| `{{ .Data.verification_code }}` | The 6-digit code | Main code display |
| `{{ .Data.listing_name }}` | The listing name | Personalization |
| `{{ .ConfirmationURL }}` | Magic link token | Not recommended — use code instead |

## Alternative: If Email is Not Arriving

If emails aren't arriving at all, verify:

1. **Custom SMTP not configured**: Supabase will use its default SMTP. Emails should come from `auth@supabase.co` initially.
2. **Email verified**: The email address in `practitioners.email` must be valid.
3. **Rate limiting**: Check `verification_codes` table for rate limit errors (5 attempts/hour).

Contact your Supabase support or check logs at:
- Supabase Dashboard → **Auth** → **Users** → click user → **Logs** tab

## Sending OTP to Different Email

If a provider wants to verify a different email than the listing's email, they can:
1. Update their listing email in their dashboard
2. The verification status clears automatically (via `clear_verification_on_contact_change` trigger)
3. Start a new verification flow

## SMS Verification Template

SMS verification uses Twilio and a fixed message. To customize SMS, edit `supabase/functions/send-verification-code/index.ts` line 271:

```typescript
`Your Aloha Health Hub verification code is: ${code}. It expires in 10 minutes.`
```

Then redeploy:
```bash
supabase functions deploy send-verification-code --no-verify-jwt
```
