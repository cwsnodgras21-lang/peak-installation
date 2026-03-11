begin;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
as $$
  select p.tenant_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

revoke all on function public.current_tenant_id() from public;
grant execute on function public.current_tenant_id() to authenticated;

-- TENANTS
drop policy if exists tenants_select_own on public.tenants;
create policy tenants_select_own
on public.tenants
for select
to authenticated
using (id = public.current_tenant_id());

-- PROFILES
drop policy if exists profiles_select_tenant on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;

create policy profiles_select_tenant
on public.profiles
for select
to authenticated
using (tenant_id = public.current_tenant_id());

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and tenant_id is not null
);

-- PROJECTS
drop policy if exists projects_select_tenant on public.projects;
drop policy if exists projects_write_tenant on public.projects;

create policy projects_select_tenant
on public.projects
for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy projects_write_tenant
on public.projects
for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

-- LABOR ROLES
drop policy if exists labor_roles_select_tenant on public.labor_roles;
drop policy if exists labor_roles_write_tenant on public.labor_roles;

create policy labor_roles_select_tenant
on public.labor_roles
for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy labor_roles_write_tenant
on public.labor_roles
for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

-- SCHEDULE VERSIONS
drop policy if exists schedule_versions_select_tenant on public.schedule_versions;
drop policy if exists schedule_versions_write_tenant on public.schedule_versions;

create policy schedule_versions_select_tenant
on public.schedule_versions
for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy schedule_versions_write_tenant
on public.schedule_versions
for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

-- SCHEDULE LABOR WEEKS
drop policy if exists schedule_labor_weeks_select_tenant on public.schedule_labor_weeks;
drop policy if exists schedule_labor_weeks_write_tenant on public.schedule_labor_weeks;

create policy schedule_labor_weeks_select_tenant
on public.schedule_labor_weeks
for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy schedule_labor_weeks_write_tenant
on public.schedule_labor_weeks
for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

-- WORKFORCE AVAILABILITY
drop policy if exists workforce_availability_weeks_select_tenant on public.workforce_availability_weeks;
drop policy if exists workforce_availability_weeks_write_tenant on public.workforce_availability_weeks;

create policy workforce_availability_weeks_select_tenant
on public.workforce_availability_weeks
for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy workforce_availability_weeks_write_tenant
on public.workforce_availability_weeks
for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

-- FINANCIAL EXPOSURES
drop policy if exists financial_exposures_select_tenant on public.financial_exposures;
drop policy if exists financial_exposures_write_tenant on public.financial_exposures;

create policy financial_exposures_select_tenant
on public.financial_exposures
for select to authenticated
using (tenant_id = public.current_tenant_id());

create policy financial_exposures_write_tenant
on public.financial_exposures
for all to authenticated
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

commit;