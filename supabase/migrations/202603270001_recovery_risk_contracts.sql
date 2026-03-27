create table if not exists public.invoice_recovery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  stage text not null check (stage in ('soft', 'firm', 'final')),
  sent_to text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (invoice_id, stage)
);

create index if not exists idx_invoice_recovery_logs_invoice_id on public.invoice_recovery_logs(invoice_id);
create index if not exists idx_invoice_recovery_logs_user_id on public.invoice_recovery_logs(user_id);

create table if not exists public.client_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  late_count integer not null default 0,
  avg_delay_days numeric(10,2) not null default 0,
  score numeric(10,2) not null default 100,
  label text not null default 'Safe' check (label in ('Safe', 'Moderate', 'Risky')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (client_id)
);

create index if not exists idx_client_scores_user_id on public.client_scores(user_id);

alter table public.contracts
  add column if not exists milestone_amount numeric(12,2),
  add column if not exists auto_invoice boolean not null default false;

create or replace function public.set_client_score_label()
returns trigger
language plpgsql
as $$
begin
  new.label := case
    when new.score >= 75 then 'Safe'
    when new.score >= 45 then 'Moderate'
    else 'Risky'
  end;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_client_score_label on public.client_scores;
create trigger trg_set_client_score_label
before insert or update on public.client_scores
for each row
execute function public.set_client_score_label();

alter table public.invoice_recovery_logs enable row level security;
alter table public.client_scores enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'invoice_recovery_logs'
      and policyname = 'invoice_recovery_logs_select_owner'
  ) then
    create policy invoice_recovery_logs_select_owner on public.invoice_recovery_logs
    for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'invoice_recovery_logs'
      and policyname = 'invoice_recovery_logs_insert_owner'
  ) then
    create policy invoice_recovery_logs_insert_owner on public.invoice_recovery_logs
    for insert
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_scores'
      and policyname = 'client_scores_select_owner'
  ) then
    create policy client_scores_select_owner on public.client_scores
    for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_scores'
      and policyname = 'client_scores_insert_owner'
  ) then
    create policy client_scores_insert_owner on public.client_scores
    for insert
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_scores'
      and policyname = 'client_scores_update_owner'
  ) then
    create policy client_scores_update_owner on public.client_scores
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end
$$;
