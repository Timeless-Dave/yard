-- The Yard — kickbacks / night parties
-- Run after 007_seasonal_sales.sql, in the SQL Editor.

create table if not exists parties (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references auth.users (id) on delete set null,
  host_name text not null,
  title text not null,
  vibe text not null check (vibe in ('kickback', 'block_party', 'after_party')),
  spot text not null, -- named location key, see src/partySpots.js
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint sane_window check (ends_at > starts_at)
);

alter table parties enable row level security;

create policy "Parties are viewable by everyone"
  on parties for select
  using (true);

create policy "Signed-in users can host a party"
  on parties for insert
  with check (auth.uid() = host_id);

create policy "Hosts can cancel their own party"
  on parties for delete
  using (auth.uid() = host_id);

create table if not exists party_rsvps (
  party_id uuid not null references parties (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

alter table party_rsvps enable row level security;

create policy "RSVPs are viewable by everyone"
  on party_rsvps for select
  using (true);

create policy "Signed-in users can RSVP as themselves"
  on party_rsvps for insert
  with check (auth.uid() = user_id);

create policy "Users can un-RSVP themselves"
  on party_rsvps for delete
  using (auth.uid() = user_id);

create or replace view party_tallies as
select p.*, count(r.user_id) as rsvp_count
from parties p
left join party_rsvps r on r.party_id = p.id
group by p.id;

alter publication supabase_realtime add table parties;
alter publication supabase_realtime add table party_rsvps;
