-- The Yard — org membership rosters + Probate Night
-- Run after 003_voting.sql, in the SQL Editor.
--
-- This deliberately models only the public, celebratory parts of NPHC life
-- (membership rosters, the public "probate" stepping reveal) — no pledge
-- process or ritual content is represented anywhere in this app.

create table if not exists org_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  letters text not null,
  display_name text not null,
  joined_at timestamptz not null default now()
);

alter table org_members enable row level security;

create policy "Org rosters are viewable by everyone"
  on org_members for select
  using (true);

create policy "Users can join one org as themselves"
  on org_members for insert
  with check (auth.uid() = user_id);

create policy "Users can leave their own org"
  on org_members for delete
  using (auth.uid() = user_id);

-- Probate Night sign-ups: a scheduled public stepping reveal slot for a
-- new member. Purely a calendar/roster feature, no ritual content.
create table if not exists probate_signups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  letters text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, letters)
);

alter table probate_signups enable row level security;

create policy "Probate signups are viewable by everyone"
  on probate_signups for select
  using (true);

create policy "Members can sign up for their own org's probate"
  on probate_signups for insert
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table org_members;
alter publication supabase_realtime add table probate_signups;
