-- Run this in Supabase Dashboard > SQL Editor to fix change_orders schema.
-- Adds any missing columns and objects.

-- financial_exposure_id
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'change_orders' and column_name = 'financial_exposure_id'
  ) then
    alter table public.change_orders add column financial_exposure_id uuid null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'change_orders_exposure_fkey' and conrelid = 'public.change_orders'::regclass
  ) then
    alter table public.change_orders
      add constraint change_orders_exposure_fkey
      foreign key (financial_exposure_id) references public.financial_exposures(id);
  end if;
end $$;

-- created_at
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'change_orders' and column_name = 'created_at'
  ) then
    alter table public.change_orders add column created_at timestamptz not null default now();
  end if;
end $$;

-- updated_at
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'change_orders' and column_name = 'updated_at'
  ) then
    alter table public.change_orders add column updated_at timestamptz not null default now();
  end if;
end $$;

-- Trigger to auto-update updated_at
create or replace function public.change_orders_updated_at()
returns trigger language plpgsql as $$
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
