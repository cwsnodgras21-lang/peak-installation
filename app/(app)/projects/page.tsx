"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Project = {
  id: string;
  tenant_id: string;
  project_number: string;
  name: string;
  client_name: string | null;
  status: string;
  location: string | null;
  created_at?: string;
};

type ProjectWithCounts = Project & {
  openExposureCount: number;
  changeOrderCount: number;
  hasCapacityConflict: boolean;
};

type FilterState = {
  statusFilter: string;
  hasOpenExposure: string;
  hasChangeOrder: string;
  hasCapacityConflict: string;
  textSearch: string;
};

type SavedView = {
  id: string;
  name: string;
  filters_json: FilterState;
};

export default function ProjectsPage() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const [projectNumber, setProjectNumber] = useState("");
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hasOpenExposure, setHasOpenExposure] = useState<string>("all");
  const [hasChangeOrder, setHasChangeOrder] = useState<string>("all");
  const [hasCapacityConflict, setHasCapacityConflict] = useState<string>("all");
  const [textSearch, setTextSearch] = useState("");

  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string>("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveInputName, setSaveInputName] = useState("");
  const [viewError, setViewError] = useState<string | null>(null);

  async function loadProjects() {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profErr || !profile?.tenant_id) {
      setError("Could not load tenant.");
      setLoading(false);
      return;
    }
    const tid = profile.tenant_id;
    setTenantId(tid);

    const [projRes, expRes, coRes, forecastRes, demandRes] = await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, tenant_id, project_number, name, client_name, status, location, created_at",
        )
        .eq("tenant_id", tid)
        .order("project_number", { ascending: true }),
      supabase
        .from("financial_exposures")
        .select("id, project_id, status")
        .eq("tenant_id", tid),
      supabase
        .from("change_orders")
        .select("id, project_id")
        .eq("tenant_id", tid),
      supabase
        .from("v_capacity_forecast_12w")
        .select("week_start_date, labor_role, net_hours, net_headcount")
        .eq("tenant_id", tid),
      supabase.from("v_project_labor_demand_12w").select("project_id, week_start_date, labor_role"),
    ]);

    if (projRes.error) {
      setError(projRes.error.message);
      setLoading(false);
      return;
    }
    if (expRes.error) {
      setError(expRes.error.message);
      setLoading(false);
      return;
    }
    if (coRes.error) {
      setError(coRes.error.message);
      setLoading(false);
      return;
    }

    const projList = (projRes.data ?? []) as unknown as Project[];
    const exposures = (expRes.data ?? []) as { project_id: string; status: string | null }[];
    const changeOrders = (coRes.data ?? []) as { project_id: string }[];
    const forecast = (forecastRes.data ?? []) as {
      week_start_date: string;
      labor_role: string;
      net_hours: number | null;
      net_headcount: number | null;
    }[];
    const demand = (demandRes.data ?? []) as {
      project_id: string;
      week_start_date: string;
      labor_role: string;
    }[];

    const shortageWeeks = new Set<string>();
    forecast.forEach((r) => {
      if (
        Number(r.net_hours ?? 0) < 0 ||
        Number(r.net_headcount ?? 0) < 0
      ) {
        shortageWeeks.add(`${r.week_start_date}|||${r.labor_role}`);
      }
    });

    const conflictProjectIds = new Set<string>();
    demand.forEach((d) => {
      if (shortageWeeks.has(`${d.week_start_date}|||${d.labor_role}`)) {
        conflictProjectIds.add(d.project_id);
      }
    });

    const openExpByProject: Record<string, number> = {};
    exposures.forEach((e) => {
      if ((e.status ?? "").toLowerCase() === "open") {
        openExpByProject[e.project_id] = (openExpByProject[e.project_id] ?? 0) + 1;
      }
    });

    const coByProject: Record<string, number> = {};
    changeOrders.forEach((c) => {
      coByProject[c.project_id] = (coByProject[c.project_id] ?? 0) + 1;
    });

    const projectsWithCounts: ProjectWithCounts[] = projList.map((p) => ({
      ...p,
      openExposureCount: openExpByProject[p.id] ?? 0,
      changeOrderCount: coByProject[p.id] ?? 0,
      hasCapacityConflict: conflictProjectIds.has(p.id),
    }));

    setProjects(projectsWithCounts);
    setLoading(false);
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const pn = projectNumber.trim();
    const nm = name.trim();

    if (!pn || !nm) {
      setError("Project # and Name are required.");
      return;
    }

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      setError("You are not signed in.");
      return;
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profErr) {
      setError(`Could not load profile: ${profErr.message}`);
      return;
    }

    const { error: insErr } = await supabase.from("projects").insert({
      tenant_id: profile.tenant_id,
      project_number: pn,
      name: nm,
      client_name: clientName.trim() || null,
      status: "active",
    });

    if (insErr) {
      setError(insErr.message);
      return;
    }

    setProjectNumber("");
    setName("");
    setClientName("");
    await loadProjects();
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadSavedViews() {
    if (!tenantId) return;
    const { data } = await supabase
      .from("project_filter_views")
      .select("id, name, filters_json")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true });
    const views = (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      filters_json: (r.filters_json ?? {}) as FilterState,
    }));
    setSavedViews(views);
  }

  useEffect(() => {
    loadSavedViews();
  }, [tenantId]);

  function getCurrentFilters(): FilterState {
    return {
      statusFilter,
      hasOpenExposure,
      hasChangeOrder,
      hasCapacityConflict,
      textSearch,
    };
  }

  function applyFilters(f: FilterState) {
    setStatusFilter(f.statusFilter ?? "all");
    setHasOpenExposure(f.hasOpenExposure ?? "all");
    setHasChangeOrder(f.hasChangeOrder ?? "all");
    setHasCapacityConflict(f.hasCapacityConflict ?? "all");
    setTextSearch(f.textSearch ?? "");
  }

  async function handleSaveView() {
    const n = saveInputName.trim();
    if (!n) {
      setViewError("Name is required.");
      return;
    }
    if (!tenantId) return;
    setViewError(null);
    const filters = getCurrentFilters();
    const { error: insErr } = await supabase
      .from("project_filter_views")
      .insert({
        tenant_id: tenantId,
        name: n,
        filters_json: filters,
      });
    if (insErr) {
      if (insErr.code === "23505") setViewError("A view with that name already exists.");
      else setViewError(insErr.message);
      return;
    }
    setShowSaveInput(false);
    setSaveInputName("");
    await loadSavedViews();
  }

  function handleLoadView(viewId: string) {
    setSelectedViewId(viewId);
    if (!viewId) return;
    const v = savedViews.find((x) => x.id === viewId);
    if (v) applyFilters(v.filters_json);
  }

  async function handleDeleteView() {
    if (!selectedViewId) return;
    await supabase
      .from("project_filter_views")
      .delete()
      .eq("id", selectedViewId)
      .eq("tenant_id", tenantId!);
    setSelectedViewId("");
    await loadSavedViews();
  }

  const statusOptions = [...new Set(projects.map((p) => p.status))].sort();

  const filtered = projects.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (hasOpenExposure === "yes" && p.openExposureCount === 0) return false;
    if (hasOpenExposure === "no" && p.openExposureCount > 0) return false;
    if (hasChangeOrder === "yes" && p.changeOrderCount === 0) return false;
    if (hasChangeOrder === "no" && p.changeOrderCount > 0) return false;
    if (hasCapacityConflict === "yes" && !p.hasCapacityConflict) return false;
    if (hasCapacityConflict === "no" && p.hasCapacityConflict) return false;
    const q = textSearch.trim().toLowerCase();
    if (q) {
      const match =
        p.project_number.toLowerCase().includes(q) ||
        (p.name ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const scoreA =
      (a.hasCapacityConflict ? 4 : 0) +
      (a.openExposureCount > 0 ? 2 : 0) +
      (a.changeOrderCount > 0 ? 1 : 0);
    const scoreB =
      (b.hasCapacityConflict ? 4 : 0) +
      (b.openExposureCount > 0 ? 2 : 0) +
      (b.changeOrderCount > 0 ? 1 : 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return (a.project_number ?? "").localeCompare(b.project_number ?? "");
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <header
        className="pi-page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div>
          <h1 className="pi-page-title" style={{ fontSize: 24, marginBottom: 6 }}>
            Projects
          </h1>
          <p className="pi-page-desc">
            Create and manage projects. Filter by status, exposures, change
            orders, and capacity.
          </p>
        </div>
        <Link
          href="/help#page-guide"
          style={{
            fontSize: 12,
            color: "var(--muted)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
          }}
        >
          <span style={{ opacity: 0.7 }}>?</span> Help
        </Link>
      </header>

      <form onSubmit={createProject} className="pi-card" style={{ maxWidth: 720 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div className="pi-form-group">
            <label>Project # *</label>
            <input
              className="pi-input"
              value={projectNumber}
              onChange={(e) => setProjectNumber(e.target.value)}
              placeholder="P-1002"
            />
          </div>
          <div className="pi-form-group">
            <label>Name *</label>
            <input
              className="pi-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New Conveyor Install"
            />
          </div>
          <div className="pi-form-group">
            <label>Client</label>
            <input
              className="pi-input"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Amazon / FedEx / etc."
            />
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="submit" className="pi-btn">
              Create Project
            </button>
            {error ? <span style={{ color: "var(--bad)" }}>{error}</span> : null}
          </div>
        </div>
      </form>

      <div className="pi-card-lift" style={{ overflow: "hidden" }}>
        <h2 className="pi-section-title" style={{ marginBottom: 16 }}>
          Current Projects
        </h2>

        {loading ? (
          <p className="pi-page-desc" style={{ padding: "24px 0" }}>
            Loading…
          </p>
        ) : projects.length === 0 ? (
          <div className="pi-empty">
            <div className="pi-empty-title">No projects yet</div>
            <span>Create a project above to get started.</span>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 16,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                  paddingRight: 12,
                  borderRight: "1px solid var(--border-faint)",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                  Saved Views
                </span>
                <select
                  value={selectedViewId}
                  onChange={(e) => handleLoadView(e.target.value)}
                  className="pi-input"
                  style={{
                    width: "auto",
                    minWidth: 140,
                    cursor: "pointer",
                  }}
                >
                  <option value="">— Select —</option>
                  {savedViews.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                {showSaveInput ? (
                  <>
                    <input
                      type="text"
                      placeholder="View name"
                      value={saveInputName}
                      onChange={(e) => setSaveInputName(e.target.value)}
                      className="pi-input"
                      style={{ width: 120 }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveView}
                      className="pi-btn pi-btn-sm"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSaveInput(false);
                        setSaveInputName("");
                        setViewError(null);
                      }}
                      className="pi-btn-ghost"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSaveInput(true)}
                    className="pi-btn-ghost"
                    style={{ fontSize: 12 }}
                  >
                    Save current
                  </button>
                )}
                {selectedViewId && (
                  <button
                    type="button"
                    onClick={handleDeleteView}
                    className="pi-btn-ghost"
                    style={{ fontSize: 12, color: "var(--bad)" }}
                  >
                    Delete
                  </button>
                )}
                {viewError && (
                  <span style={{ fontSize: 12, color: "var(--bad)" }}>{viewError}</span>
                )}
              </div>
              <input
                type="text"
                placeholder="Search project # or name"
                value={textSearch}
                onChange={(e) => setTextSearch(e.target.value)}
                className="pi-input"
                style={{
                  width: "auto",
                  minWidth: 200,
                  maxWidth: 280,
                }}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pi-input"
                style={{ width: "auto", minWidth: 120, cursor: "pointer" }}
              >
                <option value="all">All statuses</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={hasOpenExposure}
                onChange={(e) => setHasOpenExposure(e.target.value)}
                className="pi-input"
                style={{ width: "auto", minWidth: 100, cursor: "pointer" }}
              >
                <option value="all">Open exp: All</option>
                <option value="yes">Open exp: Yes</option>
                <option value="no">Open exp: No</option>
              </select>
              <select
                value={hasChangeOrder}
                onChange={(e) => setHasChangeOrder(e.target.value)}
                className="pi-input"
                style={{ width: "auto", minWidth: 100, cursor: "pointer" }}
              >
                <option value="all">CO: All</option>
                <option value="yes">CO: Yes</option>
                <option value="no">CO: No</option>
              </select>
              <select
                value={hasCapacityConflict}
                onChange={(e) => setHasCapacityConflict(e.target.value)}
                className="pi-input"
                style={{ width: "auto", minWidth: 100, cursor: "pointer" }}
              >
                <option value="all">Conflict: All</option>
                <option value="yes">Conflict: Yes</option>
                <option value="no">Conflict: No</option>
              </select>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                {sorted.length} of {projects.length} projects
              </span>
            </div>

            {sorted.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                No projects match the current filters.
              </p>
            ) : (
              <div className="pi-table-wrap">
                <table className="pi-table pi-table-dashboard">
                  <thead>
                    <tr>
                      <th>Project #</th>
                      <th>Name</th>
                      <th>Client</th>
                      <th style={{ width: 90 }}>Status</th>
                      <th style={{ width: 90, textAlign: "center" }}>
                        Open Exp
                      </th>
                      <th style={{ width: 70, textAlign: "center" }}>COs</th>
                      <th style={{ width: 80, textAlign: "center" }}>
                        Conflict
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <Link
                            href={`/projects/${p.id}`}
                            style={{
                              fontWeight: 600,
                              color: "var(--text)",
                              textDecoration: "none",
                            }}
                          >
                            {p.project_number}
                          </Link>
                        </td>
                        <td>
                          <Link
                            href={`/projects/${p.id}`}
                            style={{
                              color: "var(--text)",
                              textDecoration: "none",
                            }}
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td>{p.client_name ?? "—"}</td>
                        <td>
                          <span
                            className="pi-badge"
                            style={{ textTransform: "capitalize" }}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {p.openExposureCount > 0 ? (
                            <span
                              className="pi-badge pi-badge-warn"
                              style={{
                                padding: "2px 6px",
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              {p.openExposureCount}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 13,
                                color: "var(--muted)",
                              }}
                            >
                              0
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {p.changeOrderCount > 0 ? (
                            <span
                              className="pi-badge"
                              style={{
                                padding: "2px 6px",
                                fontSize: 10,
                                fontWeight: 700,
                                background: "rgba(255,140,0,0.2)",
                                border: "1px solid rgba(255,140,0,0.4)",
                              }}
                            >
                              {p.changeOrderCount}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 13,
                                color: "var(--muted)",
                              }}
                            >
                              0
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {p.hasCapacityConflict ? (
                            <span
                              className="pi-badge pi-badge-bad"
                              style={{
                                padding: "2px 6px",
                                fontSize: 10,
                                fontWeight: 700,
                              }}
                            >
                              Yes
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 13,
                                color: "var(--muted)",
                              }}
                            >
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
