-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: is_featured boolean is never set to true by any code path.
-- The set_user_tier RPC, syncTierToListings webhook, and admin mutations
-- all update `tier` text but never touch `is_featured` boolean.
-- This caused featured listings to be invisible on the homepage because
-- .order('is_featured', ...) treated all rows as equal (all false).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Step 1: Backfill existing data ────────────────────────────────────────────
UPDATE practitioners SET is_featured = true  WHERE tier = 'featured' AND is_featured = false;
UPDATE practitioners SET is_featured = false WHERE tier != 'featured' AND is_featured = true;
UPDATE centers       SET is_featured = true  WHERE tier = 'featured' AND is_featured = false;
UPDATE centers       SET is_featured = false WHERE tier != 'featured' AND is_featured = true;

-- ── Step 2: Recreate set_user_tier RPC to keep is_featured in sync ───────────
CREATE OR REPLACE FUNCTION public.set_user_tier(
  p_user_id uuid,
  p_new_tier text,
  p_old_tier text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing RECORD;
BEGIN
  -- Validate tier
  IF p_new_tier NOT IN ('free', 'premium', 'featured') THEN
    RAISE EXCEPTION 'Invalid tier: %', p_new_tier;
  END IF;

  -- Update user_profiles tier
  INSERT INTO user_profiles (id, tier, updated_at)
  VALUES (p_user_id, p_new_tier, now())
  ON CONFLICT (id) DO UPDATE SET
    tier = p_new_tier,
    updated_at = now();

  -- Update all practitioner listings owned by this user (tier + is_featured)
  UPDATE practitioners
  SET tier = p_new_tier,
      is_featured = (p_new_tier = 'featured'),
      updated_at = now()
  WHERE owner_id = p_user_id;

  -- Update all center listings owned by this user (tier + is_featured)
  UPDATE centers
  SET tier = p_new_tier,
      is_featured = (p_new_tier = 'featured'),
      updated_at = now()
  WHERE owner_id = p_user_id;

  -- Manage featured slots
  IF p_new_tier = 'featured' THEN
    -- Create featured slots for all owned practitioner listings
    FOR v_listing IN
      SELECT id, island FROM practitioners WHERE owner_id = p_user_id
    LOOP
      INSERT INTO featured_slots (listing_id, listing_type, island, owner_id, active_since)
      VALUES (v_listing.id, 'practitioner', v_listing.island, p_user_id, now())
      ON CONFLICT (listing_id) DO UPDATE SET
        grace_until = NULL;
    END LOOP;

    -- Create featured slots for all owned center listings
    FOR v_listing IN
      SELECT id, island FROM centers WHERE owner_id = p_user_id
    LOOP
      INSERT INTO featured_slots (listing_id, listing_type, island, owner_id, active_since)
      VALUES (v_listing.id, 'center', v_listing.island, p_user_id, now())
      ON CONFLICT (listing_id) DO UPDATE SET
        grace_until = NULL;
    END LOOP;
  ELSIF p_old_tier = 'featured' AND p_new_tier != 'featured' THEN
    -- Set 90-day grace period on featured slots (don't delete immediately)
    UPDATE featured_slots
    SET grace_until = now() + interval '90 days'
    WHERE owner_id = p_user_id
      AND grace_until IS NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_tier(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_tier(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_user_tier(uuid, text, text) TO authenticated;
