-- Migration: 006_guardrails.sql
-- Database + workflow guardrails: one CO per exposure, protect against unsafe deletes.
-- Does not change schema structure; adds constraints and triggers only.

begin;

-- =============================================================================
-- 1. ONE CURRENT SCHEDULE VERSION PER PROJECT
-- =============================================================================
-- Already enforced by schedule_versions_one_current_per_project (003).
-- No change needed.

-- =============================================================================
-- 2. PREVENT DUPLICATE LINKED CHANGE ORDERS PER EXPOSURE
-- =============================================================================
-- At most one change_order may link to a given financial_exposure_id.
-- Nulls allowed (manual COs with no linked exposure).

create unique index if not exists change_orders_one_per_exposure
  on public.change_orders (financial_exposure_id)
  where (financial_exposure_id is not null);

-- =============================================================================
-- 3. PROTECT AGAINST UNSAFE DELETES
-- =============================================================================

-- Block DELETE on schedule_versions (preserve history)
create or replace function public.guard_schedule_versions_no_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Deleting schedule_versions is not allowed. Use archive/status patterns instead.'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists guard_schedule_versions_delete on public.schedule_versions;
create trigger guard_schedule_versions_delete
  before delete on public.schedule_versions
  for each row
  execute function public.guard_schedule_versions_no_delete();

-- Block DELETE on financial_exposures when linked to any change_order
create or replace function public.guard_financial_exposures_no_delete_when_linked()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from public.change_orders
    where financial_exposure_id = old.id
  ) then
    raise exception 'Cannot delete financial_exposure linked to a change_order. Use status=closed instead.'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists guard_financial_exposures_delete on public.financial_exposures;
create trigger guard_financial_exposures_delete
  before delete on public.financial_exposures
  for each row
  execute function public.guard_financial_exposures_no_delete_when_linked();

-- Block DELETE on change_orders (preserve recovery history)
create or replace function public.guard_change_orders_no_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Deleting change_orders is not allowed. Use status=cancelled instead.'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists guard_change_orders_delete on public.change_orders;
create trigger guard_change_orders_delete
  before delete on public.change_orders
  for each row
  execute function public.guard_change_orders_no_delete();

commit;

-- =============================================================================
-- SUMMARY
-- =============================================================================
--
-- Enforced by this migration:
-- • At most one change_order per financial_exposure_id (unique partial index)
-- • No DELETE on schedule_versions
-- • No DELETE on financial_exposures when linked to a change_order
-- • No DELETE on change_orders
--
-- Already enforced by 003:
-- • One current schedule version per project
--
-- Documented gaps (see GUARDRAILS.md):
-- • Client-driven exposure creation: app-level only; RPC + insert are separate
-- • Tenant safety: RLS enforces; app uses tenant_id in inserts/updates
