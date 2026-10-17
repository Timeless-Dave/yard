-- The Yard — Homecoming King/Queen voting
-- Run after 002_economy.sql, in the SQL Editor.

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('king', 'queen')),
  name text not null,
  nominated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table candidates enable row level security;

create policy "Candidates are viewable by everyone"
  on candidates for select
  using (true);

create policy "Signed-in users can nominate"
  on candidates for insert
  with check (auth.uid() = nominated_by);

-- One vote per category per user; voting again changes your vote (upsert).
create table if not exists votes (
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('king', 'queen')),
  candidate_id uuid not null references candidates (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table votes enable row level security;

create policy "Vote tallies are viewable by everyone"
  on votes for select
  using (true);

create policy "Signed-in users can cast their own vote"
  on votes for insert
  with check (auth.uid() = user_id);

create policy "Signed-in users can change their own vote"
  on votes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace view candidate_tallies as
select c.id, c.category, c.name, count(v.user_id) as vote_count
from candidates c
left join votes v on v.candidate_id = c.id
group by c.id, c.category, c.name;

alter publication supabase_realtime add table candidates;
alter publication supabase_realtime add table votes;
