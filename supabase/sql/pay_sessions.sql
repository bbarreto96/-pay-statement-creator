-- Supabase sessions schema for pay statement tracker
-- Run this in Supabase SQL Editor. Re-run safe (idempotent via IF NOT EXISTS / DO blocks).

begin;

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- Sessions: one per pay period
create table if not exists public.app_pay_sessions (
  id uuid primary key default gen_random_uuid(),
  pay_period_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Entries: one per contractor in a session
create table if not exists public.app_pay_session_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.app_pay_sessions(id) on delete cascade,
  contractor_id text not null,
  contractor_name text not null,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Indexes & uniqueness
create index if not exists idx_pay_entries_session_id
  on public.app_pay_session_entries(session_id);
create unique index if not exists uq_pay_entries_session_contractor
  on public.app_pay_session_entries(session_id, contractor_id);

-- RLS
alter table public.app_pay_sessions enable row level security;
alter table public.app_pay_session_entries enable row level security;

-- Policies (anon read/write like app_contractors). Use DO blocks to be idempotent.

drop policy if exists "auth_select_sessions" on public.app_pay_sessions;
drop policy if exists "auth_ins_sessions" on public.app_pay_sessions;
drop policy if exists "auth_upd_sessions" on public.app_pay_sessions;
drop policy if exists "auth_del_sessions" on public.app_pay_sessions;
drop policy if exists "auth_select_entries" on public.app_pay_session_entries;
drop policy if exists "auth_ins_entries" on public.app_pay_session_entries;
drop policy if exists "auth_upd_entries" on public.app_pay_session_entries;
drop policy if exists "auth_del_entries" on public.app_pay_session_entries;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_pay_sessions' and policyname = 'anon_select_sessions'
  ) then
    create policy "anon_select_sessions" on public.app_pay_sessions for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_pay_sessions' and policyname = 'anon_ins_sessions'
  ) then
    create policy "anon_ins_sessions" on public.app_pay_sessions for insert with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_pay_sessions' and policyname = 'anon_upd_sessions'
  ) then
    create policy "anon_upd_sessions" on public.app_pay_sessions for update using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_pay_sessions' and policyname = 'anon_del_sessions'
  ) then
    create policy "anon_del_sessions" on public.app_pay_sessions for delete using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_pay_session_entries' and policyname = 'anon_select_entries'
  ) then
    create policy "anon_select_entries" on public.app_pay_session_entries for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_pay_session_entries' and policyname = 'anon_ins_entries'
  ) then
    create policy "anon_ins_entries" on public.app_pay_session_entries for insert with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_pay_session_entries' and policyname = 'anon_upd_entries'
  ) then
    create policy "anon_upd_entries" on public.app_pay_session_entries for update using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_pay_session_entries' and policyname = 'anon_del_entries'
  ) then
    create policy "anon_del_entries" on public.app_pay_session_entries for delete using (true);
  end if;
end $$;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_sessions_updated_at on public.app_pay_sessions;
create trigger trg_sessions_updated_at
before update on public.app_pay_sessions
for each row execute function public.set_updated_at();

commit;
