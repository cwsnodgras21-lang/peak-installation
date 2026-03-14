-- Migration: 007_project_filter_views.sql
-- Saved filter views for Projects page. Tenant-scoped, minimal schema.

begin;

create table if not exists public.project_filter_views (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  filters_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index if not exists project_filter_views_tenant_id_idx
  on public.project_filter_views (tenant_id);

alter table public.project_filter_views enable row level security;

drop policy if exists project_filter_views_select_tenant on public.project_filter_views;
drop policy if exists project_filter_views_insert_tenant on public.project_filter_views;
drop policy if exists project_filter_views_update_tenant on public.project_filter_views;
drop policy if exists project_filter_views_delete_tenant on public.project_filter_views;

create policy project_filter_views_select_tenant
  on public.project_filter_views for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy project_filter_views_insert_tenant
  on public.project_filter_views for insert to authenticated
  with check (tenant_id = public.current_tenant_id());

create policy project_filter_views_update_tenant
  on public.project_filter_views for update to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy project_filter_views_delete_tenant
  on public.project_filter_views for delete to authenticated
  using (tenant_id = public.current_tenant_id());

commit;
