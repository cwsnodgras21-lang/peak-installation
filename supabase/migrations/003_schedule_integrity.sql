-- Migration: 003_schedule_integrity.sql
-- Enforces schedule integrity rules: Monday week_start_date, one current version per project,
-- foreign keys, and NOT NULL for tenant/week columns. Uses guards so existing bad data
-- does not break the migration where possible.

begin;

-- =============================================================================
-- 1. ENFORCE week_start_date IS ALWAYS MONDAY
-- =============================================================================
-- ISO weekday: Monday = 1. Added with NOT VALID so existing non-Monday rows
-- do not block the migration. After fixing bad data, run:
--   ALTER TABLE ... VALIDATE CONSTRAINT ...;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'schedule_labor_weeks_week_start_monday'
      and conrelid = 'public.schedule_labor_weeks'::regclass
  ) then
    alter table public.schedule_labor_weeks
      add constraint schedule_labor_weeks_week_start_monday
      check (extract(isodow from week_start_date) = 1)
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'workforce_availability_weeks_week_start_monday'
      and conrelid = 'public.workforce_availability_weeks'::regclass
  ) then
    alter table public.workforce_availability_weeks
      add constraint workforce_availability_weeks_week_start_monday
      check (extract(isodow from week_start_date) = 1)
      not valid;
  end if;
end $$;

-- =============================================================================
-- 2. ENFORCE ONLY ONE CURRENT SCHEDULE VERSION PER PROJECT
-- =============================================================================
-- If creation fails (duplicate key), fix data so at most one row per project
-- has is_current = true, then re-run.

create unique index if not exists schedule_versions_one_current_per_project
  on public.schedule_versions (project_id)
  where (is_current = true);

-- =============================================================================
-- 3. ADD FOREIGN KEYS (only if missing)
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'schedule_versions_project_id_fkey'
      and conrelid = 'public.schedule_versions'::regclass
  ) then
    alter table public.schedule_versions
      add constraint schedule_versions_project_id_fkey
      foreign key (project_id) references public.projects(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'schedule_labor_weeks_schedule_version_id_fkey'
      and conrelid = 'public.schedule_labor_weeks'::regclass
  ) then
    alter table public.schedule_labor_weeks
      add constraint schedule_labor_weeks_schedule_version_id_fkey
      foreign key (schedule_version_id) references public.schedule_versions(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'schedule_labor_weeks_labor_role_id_fkey'
      and conrelid = 'public.schedule_labor_weeks'::regclass
  ) then
    alter table public.schedule_labor_weeks
      add constraint schedule_labor_weeks_labor_role_id_fkey
      foreign key (labor_role_id) references public.labor_roles(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'financial_exposures_schedule_version_id_fkey'
      and conrelid = 'public.financial_exposures'::regclass
  ) then
    alter table public.financial_exposures
      add constraint financial_exposures_schedule_version_id_fkey
      foreign key (schedule_version_id) references public.schedule_versions(id);
  end if;
end $$;

-- =============================================================================
-- 4. NOT NULL CONSTRAINTS (tenant_id and week_start_date)
-- =============================================================================
-- Applied only when no existing rows have NULLs, to avoid failing on bad data.
-- If a block skips, fix NULLs and re-run or add the constraint manually.

-- Tenant-scoped tables: tenant_id NOT NULL
do $$
begin
  if (select count(*) from public.profiles where tenant_id is null) = 0 then
    alter table public.profiles alter column tenant_id set not null;
  else
    raise notice 'Skipped profiles.tenant_id NOT NULL: existing NULLs. Fix and re-run.';
  end if;
end $$;

do $$
begin
  if (select count(*) from public.projects where tenant_id is null) = 0 then
    alter table public.projects alter column tenant_id set not null;
  else
    raise notice 'Skipped projects.tenant_id NOT NULL: existing NULLs. Fix and re-run.';
  end if;
end $$;

do $$
begin
  if (select count(*) from public.labor_roles where tenant_id is null) = 0 then
    alter table public.labor_roles alter column tenant_id set not null;
  else
    raise notice 'Skipped labor_roles.tenant_id NOT NULL: existing NULLs. Fix and re-run.';
  end if;
end $$;

do $$
begin
  if (select count(*) from public.schedule_versions where tenant_id is null) = 0 then
    alter table public.schedule_versions alter column tenant_id set not null;
  else
    raise notice 'Skipped schedule_versions.tenant_id NOT NULL: existing NULLs. Fix and re-run.';
  end if;
end $$;

do $$
begin
  if (select count(*) from public.schedule_labor_weeks where tenant_id is null) = 0 then
    alter table public.schedule_labor_weeks alter column tenant_id set not null;
  else
    raise notice 'Skipped schedule_labor_weeks.tenant_id NOT NULL: existing NULLs. Fix and re-run.';
  end if;
end $$;

do $$
begin
  if (select count(*) from public.workforce_availability_weeks where tenant_id is null) = 0 then
    alter table public.workforce_availability_weeks alter column tenant_id set not null;
  else
    raise notice 'Skipped workforce_availability_weeks.tenant_id NOT NULL: existing NULLs. Fix and re-run.';
  end if;
end $$;

do $$
begin
  if (select count(*) from public.financial_exposures where tenant_id is null) = 0 then
    alter table public.financial_exposures alter column tenant_id set not null;
  else
    raise notice 'Skipped financial_exposures.tenant_id NOT NULL: existing NULLs. Fix and re-run.';
  end if;
end $$;

-- Weekly tables: week_start_date NOT NULL
do $$
begin
  if (select count(*) from public.schedule_labor_weeks where week_start_date is null) = 0 then
    alter table public.schedule_labor_weeks alter column week_start_date set not null;
  else
    raise notice 'Skipped schedule_labor_weeks.week_start_date NOT NULL: existing NULLs. Fix and re-run.';
  end if;
end $$;

do $$
begin
  if (select count(*) from public.workforce_availability_weeks where week_start_date is null) = 0 then
    alter table public.workforce_availability_weeks alter column week_start_date set not null;
  else
    raise notice 'Skipped workforce_availability_weeks.week_start_date NOT NULL: existing NULLs. Fix and re-run.';
  end if;
end $$;

commit;

-- =============================================================================
-- SUMMARY
-- =============================================================================
--
-- What this migration guarantees (DB-enforced):
-- • week_start_date is always Monday on schedule_labor_weeks and
--   workforce_availability_weeks (for new/updated rows; validate after fixing
--   existing data if needed).
-- • At most one current schedule version per project (unique partial index).
-- • Referential integrity: schedule_versions → projects; schedule_labor_weeks
--   → schedule_versions and labor_roles; financial_exposures → schedule_versions.
-- • tenant_id and week_start_date NOT NULL on the listed tables (where no
--   existing NULLs are present).
--
-- What still needs app changes:
-- • Ensure every schedule edit creates a new version (currently edits are
--   in-place on schedule_labor_weeks; consider creating a new version and
--   copying/editing there, or document that only "Create new version" creates
--   versions).
-- • Keep using snapToMonday() in the app when writing week_start_date so UI
--   and DB stay aligned; the CHECK will reject non-Monday values from any client.
-- • When adding project delete: enforce in app or DB (e.g. RPC or trigger) that
--   projects with schedule_versions, schedule_labor_weeks, or financial_exposures
--   are not hard-deleted (or use soft delete / cascade rules).
-- • Client-driven revision → financial exposure: ensure create_schedule_version
--   RPC (or trigger) creates a financial_exposures row when p_client_driven
--   is true; not enforced by this migration.
