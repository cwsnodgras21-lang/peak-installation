-- Migration: 005_add_change_orders_financial_exposure_id.sql
-- Adds financial_exposure_id column if missing (fixes schema/code mismatch when
-- change_orders was created without it, e.g. by create table if not exists skip).

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'change_orders'
      and column_name = 'financial_exposure_id'
  ) then
    alter table public.change_orders
      add column financial_exposure_id uuid null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'change_orders_exposure_fkey'
      and conrelid = 'public.change_orders'::regclass
  ) then
    alter table public.change_orders
      add constraint change_orders_exposure_fkey
      foreign key (financial_exposure_id) references public.financial_exposures(id);
  end if;
end $$;

commit;
