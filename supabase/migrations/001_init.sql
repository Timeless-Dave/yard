-- The Yard — UAPB multiplayer schema
-- Run this once in your Supabase project's SQL Editor (Project > SQL Editor > New query).

-- Enable the pgcrypto extension for gen_random_uuid() if not already on.
create extension if not exists pgcrypto;

-- One row per account, created on first sign-in.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Golden Lion',
  color text not null default '#f4b223',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on profiles for select
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Shared corkboard: requests / promos posted to the Yard.
create table if not exists corkboard_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  type text not null check (type in ('song', 'game', 'promo')),
  name text not null,
  msg text not null,
  created_at timestamptz not null default now()
);

alter table corkboard_posts enable row level security;

create policy "Corkboard posts are viewable by everyone"
  on corkboard_posts for select
  using (true);

create policy "Signed-in users can post"
  on corkboard_posts for insert
  with check (auth.uid() = user_id);

-- Divine Nine plot claims — one claim per set of letters.
create table if not exists plot_claims (
  letters text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  display_name text not null,
  claimed_at timestamptz not null default now()
);

alter table plot_claims enable row level security;

create policy "Plot claims are viewable by everyone"
  on plot_claims for select
  using (true);

create policy "Signed-in users can claim an open plot"
  on plot_claims for insert
  with check (auth.uid() = user_id);

create policy "Users can release their own claim"
  on plot_claims for delete
  using (auth.uid() = user_id);

-- Realtime: make sure these tables broadcast changes to subscribed clients.
alter publication supabase_realtime add table corkboard_posts;
alter publication supabase_realtime add table plot_claims;
