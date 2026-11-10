-- Burki Vocab — cloud progress table
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run again.

create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row-level security: every learner can only see and change their own row.
alter table public.progress enable row level security;

drop policy if exists "progress: read own"   on public.progress;
drop policy if exists "progress: insert own" on public.progress;
drop policy if exists "progress: update own" on public.progress;
drop policy if exists "progress: delete own" on public.progress;

create policy "progress: read own" on public.progress
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "progress: insert own" on public.progress
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "progress: update own" on public.progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "progress: delete own" on public.progress
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.progress to authenticated;
