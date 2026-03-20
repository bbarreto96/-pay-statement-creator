-- Email logs for bulk email sends
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pay_period_label text,
  to_emails text[] not null,
  subject text not null,
  body_preview text,
  attachments_count int not null,
  total_amount numeric,
  filenames text[],
  provider_id text
);

-- Basic RLS to allow anon inserts/selects
alter table public.email_logs enable row level security;
drop policy if exists email_logs_insert on public.email_logs;
drop policy if exists email_logs_select on public.email_logs;
drop policy if exists email_logs_insert_auth on public.email_logs;
drop policy if exists email_logs_select_auth on public.email_logs;
-- Allow anonymous insert/select for app usage (adjust for your security posture)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'email_logs' and policyname = 'email_logs_insert'
  ) then
    create policy email_logs_insert on public.email_logs for insert to anon with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'email_logs' and policyname = 'email_logs_select'
  ) then
    create policy email_logs_select on public.email_logs for select to anon using (true);
  end if;
end $$;
