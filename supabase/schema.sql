-- Atlas MVP schema. Run this once in the Supabase SQL Editor
-- (Project → SQL Editor → New query → paste → Run).

create table if not exists public.entertainment_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  favorite_genres text[] not null default '{}',
  avoid_genres text[] not null default '{}',
  tone text not null,
  format_preference text not null,
  created_at timestamptz not null default now()
);

alter table public.entertainment_profiles enable row level security;

create policy "Users manage their own profile"
  on public.entertainment_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.feedback_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  media_id bigint not null,
  media_type text not null,
  title text not null,
  feedback text not null,
  genre_ids int[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.feedback_history enable row level security;

create policy "Users manage their own feedback"
  on public.feedback_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Migration: pacing and endings were dropped from onboarding (binary
-- fast/slow and closed/open questions with no real TMDB signal behind
-- them). Run this once against an existing database that still has them.
alter table public.entertainment_profiles
  drop column if exists pacing,
  drop column if exists endings;
