-- Email waitlist for upcoming island directories (Maui, Oahu, Kauai).
create table if not exists island_waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  island      text,            -- 'maui' | 'oahu' | 'kauai' | null = all
  created_at  timestamptz not null default now(),
  constraint island_waitlist_email_key unique (email)
);

comment on table island_waitlist is
  'Email capture for users interested in upcoming Maui, Oahu, and Kauai directories.';

-- Allow anyone to insert (no auth required — public waitlist)
alter table island_waitlist enable row level security;
create policy "Anyone can join waitlist"
  on island_waitlist for insert
  with check (true);
