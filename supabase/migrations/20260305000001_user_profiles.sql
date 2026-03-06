-- user_profiles
-- One row per auth user. Tracks billing tier and Stripe subscription state.
-- The `tier` column here is the source of truth. practitioners.tier and
-- centers.tier are denormalized caches updated by the Stripe webhook.

create table user_profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  tier                    text not null default 'free'
                            check (tier in ('free', 'premium', 'featured')),
  stripe_customer_id      text unique,
  stripe_subscription_id  text unique,
  subscription_status     text,           -- 'active' | 'past_due' | 'canceled' | 'trialing'
  subscription_period_end timestamptz,    -- when current paid period ends
  stripe_price_id         text,           -- which price they are on (monthly/annual)
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_updated_at
  before update on user_profiles
  for each row execute procedure set_updated_at();

-- Auto-create a user_profiles row when a new auth user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- RLS
alter table user_profiles enable row level security;

create policy "Users can read their own profile"
  on user_profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on user_profiles for update
  to authenticated
  using (auth.uid() = id);

-- Admins (service role) bypass RLS entirely
