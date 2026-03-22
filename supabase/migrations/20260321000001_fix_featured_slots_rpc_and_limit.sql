-- ─────────────────────────────────────────────────────────────────────────────
-- Fix 1: set_user_tier RPC references "created_at" but column is "active_since"
-- Fix 2: Remove the 5-per-island hard limit on featured_slots
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Drop the 5-per-island limit trigger ─────────────────────────────────────
DROP TRIGGER IF EXISTS enforce_featured_slots_limit ON featured_slots;
DROP FUNCTION IF EXISTS check_featured_slots_limit();

-- ── Recreate set_user_tier with correct column name ─────────────────────────
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

  -- Update all practitioner listings owned by this user
  UPDATE practitioners
  SET tier = p_new_tier, updated_at = now()
  WHERE owner_id = p_user_id;

  -- Update all center listings owned by this user
  UPDATE centers
  SET tier = p_new_tier, updated_at = now()
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
-- Allow admin calls from client (is_admin() checked in the hook before calling)
GRANT EXECUTE ON FUNCTION public.set_user_tier(uuid, text, text) TO authenticated;
