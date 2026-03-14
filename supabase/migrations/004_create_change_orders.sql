-- Migration: 004_create_change_orders.sql
-- Creates change_orders table for Change Orders V0.5.

begin;

create table if not exists public.change_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  project_id uuid not null,
  financial_exposure_id uuid null,
  co_number text not null,
  title text not null,
  status text not null default 'draft',
  amount numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint change_orders_status_check
    check (status in ('draft','submitted','approved','billed','cancelled')),
  constraint change_orders_amount_non_negative
    check (amount >= 0),
  constraint change_orders_project_fkey
    foreign key (project_id) references public.projects(id),
  constraint change_orders_exposure_fkey
    foreign key (financial_exposure_id) references public.financial_exposures(id)
);

create index if not exists change_orders_tenant_id_idx
  on public.change_orders (tenant_id);
create index if not exists change_orders_project_id_idx
  on public.change_orders (project_id);

-- RLS
alter table public.change_orders enable row level security;

drop policy if exists change_orders_select_tenant on public.change_orders;
drop policy if exists change_orders_write_tenant on public.change_orders;

create policy change_orders_select_tenant
on public.change_orders
for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy change_orders_write_tenant
on public.change_orders
for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

-- Trigger to update updated_at
create or replace function public.change_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists change_orders_updated_at on public.change_orders;
create trigger change_orders_updated_at
  before update on public.change_orders
  for each row
  execute function public.change_orders_updated_at();

commit;
