-- listing_flags
-- Allows any visitor to flag a practitioner or center listing for admin review.

create type flag_reason as enum (
  'closed',       -- Business closed / no longer active
  'inaccurate',   -- Inaccurate information (phone, address, website, etc.)
  'duplicate'     -- Duplicate listing
);

create type flag_status as enum (
  'pending',    -- Awaiting admin review
  'reviewed',   -- Admin has seen it and taken action
  'dismissed'   -- Admin determined flag was not valid
);

create table listing_flags (
  id            uuid primary key default gen_random_uuid(),
  listing_type  text not null check (listing_type in ('practitioner', 'center')),
  listing_id    uuid not null,
  listing_name  text,                    -- denormalised for easy admin display
  reason        flag_reason not null,
  details       text,                    -- optional reporter notes
  reporter_email text,                   -- optional, not required
  status        flag_status not null default 'pending',
  admin_notes   text,                    -- internal notes from admin
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index for admin queries
create index listing_flags_status_idx on listing_flags (status, created_at desc);
create index listing_flags_listing_idx on listing_flags (listing_type, listing_id);

-- Auto-update updated_at
create trigger listing_flags_updated_at
  before update on listing_flags
  for each row execute procedure moddatetime(updated_at);

-- RLS: anyone can insert, only authenticated admins can read/update
alter table listing_flags enable row level security;

create policy "Anyone can submit a flag"
  on listing_flags for insert
  to anon, authenticated
  with check (true);

create policy "Admins can view all flags"
  on listing_flags for select
  to authenticated
  using (true);

create policy "Admins can update flags"
  on listing_flags for update
  to authenticated
  using (true);

create policy "Admins can delete flags"
  on listing_flags for delete
  to authenticated
  using (true);
