-- The Yard — achievements (defined client-side in src/achievements.js;
-- this table just records which ones each player has earned).
-- Run after 008_parties.sql, in the SQL Editor.

create table if not exists achievement_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table achievement_progress enable row level security;

create policy "Achievements are viewable by everyone"
  on achievement_progress for select
  using (true);

create policy "Users can unlock their own achievements"
  on achievement_progress for insert
  with check (auth.uid() = user_id);

alter publication supabase_realtime add table achievement_progress;
