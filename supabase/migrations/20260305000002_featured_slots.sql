-- featured_slots
-- Tracks the 5-per-island cap for Featured tier practitioners and centers.
-- When a slot is inserted, a trigger rejects it if the island is already full.
-- When a Featured subscription lapses, the webhook deletes the row and the
-- slot reopens immediately.

create table featured_slots (
  id           uuid primary key default gen_random_uuid(),
  island       text not null,
  listing_type text not null check (listing_type in ('practitioner', 'center')),
  listing_id   uuid not null,
  owner_id     uuid references auth.users(id) on delete cascade,
  active_since timestamptz not null default now(),
  unique (listing_id)               -- each listing can only hold one slot
);

create index featured_slots_island_idx on featured_slots (island);

-- Enforce max 5 featured per island
create or replace function check_featured_slots_limit()
returns trigger language plpgsql as $$
declare
  slot_count integer;
begin
  select count(*) into slot_count
  from featured_slots
  where island = NEW.island;

  if slot_count >= 5 then
    raise exception
      'Featured slots are full for %. Only 5 featured listings are allowed per island.',
      NEW.island
      using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

create trigger enforce_featured_slots_limit
  before insert on featured_slots
  for each row execute procedure check_featured_slots_limit();

-- RLS: public can read (needed for homepage rotation), admins can write
alter table featured_slots enable row level security;

create policy "Anyone can view featured slots"
  on featured_slots for select
  to anon, authenticated
  using (true);

create policy "Authenticated users can manage their own slot"
  on featured_slots for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Update tier check constraint on practitioners to include 'featured'
alter table practitioners
  drop constraint if exists practitioners_tier_check;

alter table practitioners
  add constraint practitioners_tier_check
  check (tier in ('free', 'premium', 'featured'));

-- Same for centers
alter table centers
  drop constraint if exists centers_tier_check;

alter table centers
  add constraint centers_tier_check
  check (tier in ('free', 'premium', 'featured'));
