"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ForecastRow = {
  tenant_id: string;
  week_start_date: string;
  labor_role: string;
  demand_hours: number | null;
  available_hours: number | null;
  net_hours: number | null;
  demand_headcount: number | null;
  available_headcount: number | null;
  net_headcount: number | null;
  status: string | null;
};

type ProjectDemand = {
  project_id: string;
  project_number: string;
  project_name: string;
  week_start_date: string;
  labor_role: string;
  demand_headcount: number | string;
};

type ExposureRow = {
  id: string;
  project_id: string;
  title: string | null;
  status: string | null;
  estimated_labor_cost_delta: number | null;
  estimated_material_cost_delta: number | null;
  created_at: string | null;
};

type ProjectRef = { id: string; project_number: string; name: string };

function isShortageStatus(s: string | null): boolean {
  if (!s) return false;
  const lower = s.toLowerCase();
  return (
    /\b(red|short|shortage|negative|deficit|over|critical|insufficient)\b/.test(
      lower,
    ) || /\b(yellow|tight|warning|low|near|limited)\b/.test(lower)
  );
}

function formatWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [projectDemand, setProjectDemand] = useState<ProjectDemand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);
  const [openExposuresCount, setOpenExposuresCount] = useState(0);
  const [pendingExposuresCount, setPendingExposuresCount] = useState(0);
  const [closedExposuresCount, setClosedExposuresCount] = useState(0);
  const [totalLaborCostExposure, setTotalLaborCostExposure] = useState(0);
  const [totalMaterialCostExposure, setTotalMaterialCostExposure] = useState(0);
  const [recentExposures, setRecentExposures] = useState<ExposureRow[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<string, ProjectRef>>({});

  const [exposuresWithLinkedCO, setExposuresWithLinkedCO] = useState(0);
  const [exposuresWithoutCO, setExposuresWithoutCO] = useState(0);
  const [approvedCOValue, setApprovedCOValue] = useState(0);
  const [billedCOValue, setBilledCOValue] = useState(0);
  const [recoveryRows, setRecoveryRows] = useState<
    {
      project_id: string;
      exposure_id: string;
      exposure_title: string | null;
      exposure_status: string | null;
      co_number: string;
      co_status: string;
      co_amount: number;
    }[]
  >([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
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
        .select("id, project_number, name")
        .eq("tenant_id", tid)
        .eq("status", "active"),
      supabase
        .from("financial_exposures")
        .select(
          "id, project_id, title, status, estimated_labor_cost_delta, estimated_material_cost_delta, created_at",
        )
        .eq("tenant_id", tid)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("change_orders")
        .select("id, project_id, financial_exposure_id, co_number, status, amount")
        .eq("tenant_id", tid)
        .order("updated_at", { ascending: false }),
      supabase
        .from("v_capacity_forecast_12w")
        .select(
          "tenant_id, week_start_date, labor_role, demand_hours, available_hours, net_hours, " +
            "demand_headcount, available_headcount, net_headcount, status",
        )
        .eq("tenant_id", tid)
        .order("week_start_date", { ascending: true })
        .order("labor_role", { ascending: true }),
      supabase.from("v_project_labor_demand_12w").select("*"),
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
    if (forecastRes.error) {
      setError(forecastRes.error.message);
      setLoading(false);
      return;
    }
    if (demandRes.error) {
      setError(demandRes.error.message);
      setLoading(false);
      return;
    }

    const projects = (projRes.data ?? []) as { id: string; project_number: string; name: string }[];
    const exposures = (expRes.data ?? []) as ExposureRow[];
    const changeOrders = (coRes.data ?? []) as {
      id: string;
      project_id: string;
      financial_exposure_id: string | null;
      co_number: string;
      status: string;
      amount: number;
    }[];

    const exposureIdsWithCO = new Set(
      changeOrders
        .filter((c) => c.financial_exposure_id)
        .map((c) => c.financial_exposure_id!),
    );
    const withCO = exposures.filter((e) => exposureIdsWithCO.has(e.id)).length;
    const withoutCO = exposures.length - withCO;
    setExposuresWithLinkedCO(withCO);
    setExposuresWithoutCO(withoutCO);

    const approvedVal = changeOrders
      .filter((c) => (c.status ?? "").toLowerCase() === "approved")
      .reduce((s, c) => s + Number(c.amount ?? 0), 0);
    const billedVal = changeOrders
      .filter((c) => (c.status ?? "").toLowerCase() === "billed")
      .reduce((s, c) => s + Number(c.amount ?? 0), 0);
    setApprovedCOValue(approvedVal);
    setBilledCOValue(billedVal);

    const exposureById = new Map(exposures.map((e) => [e.id, e]));
    const linkedRecovery = changeOrders
      .filter((c) => c.financial_exposure_id)
      .map((c) => {
        const exp = exposureById.get(c.financial_exposure_id!);
        return {
          project_id: c.project_id,
          exposure_id: c.financial_exposure_id!,
          exposure_title: exp?.title ?? null,
          exposure_status: exp?.status ?? null,
          co_number: c.co_number,
          co_status: c.status ?? "draft",
          co_amount: Number(c.amount ?? 0),
        };
      })
      .slice(0, 15);
    setRecoveryRows(linkedRecovery);

    setActiveProjectsCount(projects.length);

    const openCount = exposures.filter(
      (e) => (e.status ?? "").toLowerCase() === "open",
    ).length;
    const pendingCount = exposures.filter(
      (e) => (e.status ?? "").toLowerCase() === "pending",
    ).length;
    const closedCount = exposures.filter(
      (e) => (e.status ?? "").toLowerCase() === "closed",
    ).length;
    setOpenExposuresCount(openCount);
    setPendingExposuresCount(pendingCount);
    setClosedExposuresCount(closedCount);

    const laborTotal = exposures.reduce(
      (sum, e) => sum + (e.estimated_labor_cost_delta ?? 0),
      0,
    );
    const materialTotal = exposures.reduce(
      (sum, e) => sum + (e.estimated_material_cost_delta ?? 0),
      0,
    );
    setTotalLaborCostExposure(laborTotal);
    setTotalMaterialCostExposure(materialTotal);

    const openOrPending = exposures.filter(
      (e) =>
        ["open", "pending"].includes((e.status ?? "").toLowerCase()),
    );
    setRecentExposures(openOrPending.slice(0, 10));

    const projMap: Record<string, ProjectRef> = {};
    projects.forEach((p) => {
      projMap[p.id] = p;
    });
    const expProjectIds = [...new Set(exposures.map((e) => e.project_id))];
    const missingIds = expProjectIds.filter((id) => !projMap[id]);
    if (missingIds.length > 0) {
      const { data: extra } = await supabase
        .from("projects")
        .select("id, project_number, name")
        .in("id", missingIds);
      (extra ?? []).forEach((p: ProjectRef) => {
        projMap[p.id] = p;
      });
    }
    setProjectsMap(projMap);

    setRows((forecastRes.data ?? []) as ForecastRow[]);
    setProjectDemand(demandRes.data || []);
    setLoading(false);
  }

  function statusColor(status: string) {
    if (status === "red") return "#ff4d4f";
    if (status === "yellow") return "#f5a623";
    return "#52c41a";
  }

  const shortages = rows.filter(
    (r) =>
      Number(r.net_hours ?? 0) < 0 ||
      Number(r.net_headcount ?? 0) < 0 ||
      isShortageStatus(r.status),
  );

  const laborRoles = [...new Set(rows.map((r) => r.labor_role))].filter(
    Boolean,
  ).sort();

  const filteredShortages =
    roleFilter === "all"
      ? shortages
      : shortages.filter((r) => r.labor_role === roleFilter);

  const filteredRows =
    roleFilter === "all"
      ? rows
      : rows.filter((r) => r.labor_role === roleFilter);

  function getProjectsForWeek(week: string, role: string) {
    return projectDemand.filter(
      (p) => p.week_start_date === week && p.labor_role === role,
    );
  }

  /** Build navigation target for a capacity issue row. */
  function getCapacityIssueHref(row: ForecastRow): string {
    const projects = getProjectsForWeek(row.week_start_date, row.labor_role);
    const params = new URLSearchParams({
      week: row.week_start_date,
      role: row.labor_role,
    });
    const qs = params.toString();
    if (projects.length === 1) {
      return `/projects/${projects[0].project_id}?${qs}#capacity-forecast`;
    }
    return `/projects?${qs}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <header
        className="pi-page-header"
        style={{
          marginBottom: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div>
          <h1 className="pi-page-title" style={{ fontSize: 24, marginBottom: 6 }}>
            Capacity Dashboard
          </h1>
          <p className="pi-page-desc">
            Forecast and capacity issues for the next 8–12 weeks.
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

      {loading && (
        <p className="pi-page-desc" style={{ padding: "24px 0" }}>
          Loading forecast…
        </p>
      )}
      {error && (
        <p style={{ color: "var(--bad)", padding: "12px 0" }}>{error}</p>
      )}

      {!loading && !error && (
        <>
          {/* KPI row */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 16,
            }}
          >
            <Link
              href="/projects"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="pi-stat"
                style={{
                  minWidth: 0,
                  borderLeft: "3px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <div className="pi-stat-label">Active Projects</div>
                <div className="pi-stat-value" style={{ fontSize: 22 }}>
                  {activeProjectsCount}
                </div>
              </div>
            </Link>
            <Link
              href="/exposures"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="pi-stat"
                style={{
                  minWidth: 0,
                  borderLeft:
                    openExposuresCount > 0
                      ? "3px solid var(--warn)"
                      : "3px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <div className="pi-stat-label">Open Exposures</div>
                <div
                  className="pi-stat-value"
                  style={{
                    fontSize: 22,
                    color: openExposuresCount > 0 ? "var(--warn)" : "var(--text)",
                  }}
                >
                  {openExposuresCount}
                </div>
              </div>
            </Link>
            <Link
              href="/exposures"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="pi-stat"
                style={{
                  minWidth: 0,
                  borderLeft: "3px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <div className="pi-stat-label">Pending Exposures</div>
                <div className="pi-stat-value" style={{ fontSize: 22 }}>
                  {pendingExposuresCount}
                </div>
              </div>
            </Link>
            <Link
              href="/exposures"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="pi-stat"
                style={{
                  minWidth: 0,
                  borderLeft: "3px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <div className="pi-stat-label">Closed Exposures</div>
                <div className="pi-stat-value" style={{ fontSize: 22 }}>
                  {closedExposuresCount}
                </div>
              </div>
            </Link>
            <div
              className="pi-stat"
              style={{
                minWidth: 0,
                borderLeft:
                  totalLaborCostExposure > 0
                    ? "3px solid var(--warn)"
                    : "3px solid var(--border)",
              }}
            >
              <div className="pi-stat-label">Labor Cost Exposure</div>
              <div
                className="pi-stat-value"
                style={{
                  fontSize: 18,
                  color:
                    totalLaborCostExposure > 0 ? "var(--warn)" : "var(--text)",
                }}
              >
                {formatCurrency(totalLaborCostExposure)}
              </div>
            </div>
            <div
              className="pi-stat"
              style={{
                minWidth: 0,
                borderLeft:
                  totalMaterialCostExposure > 0
                    ? "3px solid var(--warn)"
                    : "3px solid var(--border)",
              }}
            >
              <div className="pi-stat-label">Material Cost Exposure</div>
              <div
                className="pi-stat-value"
                style={{
                  fontSize: 18,
                  color:
                    totalMaterialCostExposure > 0 ? "var(--warn)" : "var(--text)",
                }}
              >
                {formatCurrency(totalMaterialCostExposure)}
              </div>
            </div>
            <Link
              href="/exposures"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="pi-stat"
                style={{
                  minWidth: 0,
                  borderLeft:
                    exposuresWithLinkedCO > 0
                      ? "3px solid var(--good)"
                      : "3px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <div className="pi-stat-label">Exposures With Linked CO</div>
                <div
                  className="pi-stat-value"
                  style={{
                    fontSize: 22,
                    color: exposuresWithLinkedCO > 0 ? "var(--good)" : "var(--text)",
                  }}
                >
                  {exposuresWithLinkedCO}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  Recovery started
                </div>
              </div>
            </Link>
            <Link
              href="/exposures"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="pi-stat"
                style={{
                  minWidth: 0,
                  borderLeft:
                    exposuresWithoutCO > 0
                      ? "3px solid var(--warn)"
                      : "3px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <div className="pi-stat-label">Exposures Without CO</div>
                <div
                  className="pi-stat-value"
                  style={{
                    fontSize: 22,
                    color: exposuresWithoutCO > 0 ? "var(--warn)" : "var(--text)",
                  }}
                >
                  {exposuresWithoutCO}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  Need change order
                </div>
              </div>
            </Link>
            <Link
              href="/change-orders"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="pi-stat"
                style={{
                  minWidth: 0,
                  borderLeft:
                    approvedCOValue > 0
                      ? "3px solid var(--brand)"
                      : "3px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <div className="pi-stat-label">Approved CO Value</div>
                <div
                  className="pi-stat-value"
                  style={{
                    fontSize: 18,
                    color: approvedCOValue > 0 ? "var(--brand)" : "var(--text)",
                  }}
                >
                  {formatCurrency(approvedCOValue)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  Awaiting billing
                </div>
              </div>
            </Link>
            <Link
              href="/change-orders"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div
                className="pi-stat"
                style={{
                  minWidth: 0,
                  borderLeft:
                    billedCOValue > 0
                      ? "3px solid var(--good)"
                      : "3px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <div className="pi-stat-label">Billed CO Value</div>
                <div
                  className="pi-stat-value"
                  style={{
                    fontSize: 18,
                    color: billedCOValue > 0 ? "var(--good)" : "var(--text)",
                  }}
                >
                  {formatCurrency(billedCOValue)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  Recovery complete
                </div>
              </div>
            </Link>
          </section>

          {/* Recovery summary section */}
          <section className="pi-card-lift" style={{ overflow: "hidden" }}>
            <h2
              className="pi-section-title"
              style={{
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              Linked Recovery (Exposure → CO)
              <Link
                href="/change-orders"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--brand)",
                  textDecoration: "none",
                }}
              >
                Change Orders →
              </Link>
            </h2>
            {recoveryRows.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                No change orders linked to exposures yet.
              </p>
            ) : (
              <div className="pi-table-wrap">
                <table className="pi-table pi-table-dashboard">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Exposure Title</th>
                      <th>CO Number</th>
                      <th style={{ width: 90 }}>CO Status</th>
                      <th style={{ textAlign: "right", width: 100 }}>
                        CO Amount
                      </th>
                      <th style={{ width: 90 }}>Exp Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recoveryRows.map((r) => (
                      <tr key={`${r.exposure_id}-${r.co_number}`}>
                        <td>
                          <Link
                            href={`/projects/${r.project_id}`}
                            style={{
                              fontWeight: 600,
                              color: "var(--text)",
                              textDecoration: "none",
                            }}
                          >
                            {projectsMap[r.project_id]?.project_number ??
                              r.project_id.slice(0, 8)}
                          </Link>
                          {projectsMap[r.project_id]?.name && (
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--muted)",
                                fontWeight: 400,
                              }}
                            >
                              {projectsMap[r.project_id].name}
                            </div>
                          )}
                        </td>
                        <td>
                          <Link
                            href="/exposures"
                            style={{
                              color: "var(--text)",
                              textDecoration: "none",
                            }}
                          >
                            {r.exposure_title ?? "—"}
                          </Link>
                        </td>
                        <td>
                          <Link
                            href="/change-orders"
                            style={{
                              fontWeight: 600,
                              color: "var(--brand)",
                              textDecoration: "none",
                            }}
                          >
                            {r.co_number}
                          </Link>
                        </td>
                        <td>
                          <span
                            className={
                              r.co_status === "approved" || r.co_status === "billed"
                                ? "pi-badge pi-badge-good"
                                : r.co_status === "submitted" || r.co_status === "draft"
                                  ? "pi-badge pi-badge-warn"
                                  : r.co_status === "cancelled"
                                    ? "pi-badge pi-badge-bad"
                                    : "pi-badge"
                            }
                          >
                            {r.co_status}
                          </span>
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatCurrency(r.co_amount)}
                        </td>
                        <td>
                          <span
                            className={
                              (r.exposure_status ?? "").toLowerCase() === "open"
                                ? "pi-badge pi-badge-warn"
                                : (r.exposure_status ?? "").toLowerCase() === "closed"
                                  ? "pi-badge pi-badge-good"
                                  : "pi-badge"
                            }
                          >
                            {r.exposure_status ?? "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Exposure summary section */}
          <section className="pi-card-lift" style={{ overflow: "hidden" }}>
            <h2
              className="pi-section-title"
              style={{
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              Recent Open / Pending Exposures
              <Link
                href="/exposures"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--brand)",
                  textDecoration: "none",
                }}
              >
                View all →
              </Link>
            </h2>
            {recentExposures.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                No open or pending exposures.
              </p>
            ) : (
              <div className="pi-table-wrap">
                <table className="pi-table pi-table-dashboard">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Title</th>
                      <th style={{ width: 90 }}>Status</th>
                      <th style={{ textAlign: "right", width: 100 }}>
                        Labor $ Δ
                      </th>
                      <th style={{ textAlign: "right", width: 100 }}>
                        Material $ Δ
                      </th>
                      <th style={{ width: 100 }}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentExposures.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <Link
                            href={`/projects/${e.project_id}`}
                            style={{
                              fontWeight: 600,
                              color: "var(--text)",
                              textDecoration: "none",
                            }}
                          >
                            {projectsMap[e.project_id]?.project_number ??
                              e.project_id.slice(0, 8)}
                          </Link>
                          {projectsMap[e.project_id]?.name && (
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--muted)",
                                fontWeight: 400,
                              }}
                            >
                              {projectsMap[e.project_id].name}
                            </div>
                          )}
                        </td>
                        <td>{e.title ?? "—"}</td>
                        <td>
                          <span
                            className={
                              (e.status ?? "").toLowerCase() === "open"
                                ? "pi-badge pi-badge-warn"
                                : (e.status ?? "").toLowerCase() === "closed"
                                  ? "pi-badge pi-badge-good"
                                  : "pi-badge"
                            }
                          >
                            {e.status ?? "—"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {formatCurrency(e.estimated_labor_cost_delta)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {formatCurrency(e.estimated_material_cost_delta)}
                        </td>
                        <td style={{ fontSize: 13, color: "var(--muted)" }}>
                          {formatDate(e.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Labor role filter — applies to issues + forecast */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="pi-input"
              style={{
                width: "auto",
                minWidth: 140,
                cursor: "pointer",
              }}
            >
              <option value="all">All roles</option>
              {laborRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              {filteredRows.length} of {rows.length} rows
            </span>
          </div>

          {/* Capacity issues — elevated when present */}
          {shortages.length > 0 && (
            <section
              className="pi-card-lift"
              style={{
                marginBottom: 0,
                borderColor: "rgba(245, 158, 11, 0.35)",
                background: "rgba(245, 158, 11, 0.04)",
              }}
            >
              <h2
                className="pi-section-title"
                style={{
                  color: "var(--warn)",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--warn)",
                  }}
                />
                Capacity Issues ({filteredShortages.length})
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {filteredShortages.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "var(--muted)",
                    }}
                  >
                    No capacity issues for this role.
                  </p>
                ) : (
                filteredShortages.map((row, i) => {
                  const projects = getProjectsForWeek(
                    row.week_start_date,
                    row.labor_role,
                  );
                  const href = getCapacityIssueHref(row);

                  return (
                    <Link
                      key={i}
                      href={href}
                      style={{
                        textDecoration: "none",
                        color: "inherit",
                        display: "block",
                      }}
                    >
                    <div
                      style={{
                        padding: "12px 14px",
                        background: "rgba(0,0,0,0.2)",
                        borderRadius: "var(--r-sm)",
                        border: "1px solid var(--border-faint)",
                        cursor: "pointer",
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(0,0,0,0.3)";
                        e.currentTarget.style.borderColor = "var(--border)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(0,0,0,0.2)";
                        e.currentTarget.style.borderColor = "var(--border-faint)";
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          marginBottom: projects.length > 0 ? 8 : 0,
                        }}
                      >
                        <span style={{ color: "var(--muted)" }}>
                          {formatWeekLabel(row.week_start_date)}
                        </span>
                        {" · "}
                        <span>{row.labor_role}</span>
                        {" · "}
                        <span
                          style={{
                            color: "var(--bad)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          Net {row.net_hours != null ? `${row.net_hours} hrs` : `${row.net_headcount} HC`}
                        </span>
                        {row.status && (
                          <>
                            {" · "}
                            <span
                              className={
                                row.status === "red" || /red|short|critical/i.test(row.status)
                                  ? "pi-badge pi-badge-bad"
                                  : "pi-badge pi-badge-warn"
                              }
                              style={{ fontSize: 10 }}
                            >
                              {row.status}
                            </span>
                          </>
                        )}
                      </div>

                      {projects.length > 0 && (
                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: 18,
                            fontSize: 13,
                            color: "var(--muted)",
                            lineHeight: 1.6,
                          }}
                        >
                          {projects.map((p, idx) => (
                            <li key={idx}>
                              <span style={{ color: "var(--text)" }}>
                                {p.project_number}
                              </span>
                              {" — "}
                              {p.project_name}
                              {" → "}
                              <span
                                style={{
                                  fontVariantNumeric: "tabular-nums",
                                  color: "var(--text)",
                                }}
                              >
                                {p.demand_headcount}
                              </span>{" "}
                              {row.labor_role.toLowerCase()}s
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    </Link>
                  );
                })
                )}
              </div>
            </section>
          )}

          {/* Forecast table */}
          <section className="pi-card-lift" style={{ overflow: "hidden" }}>
            <h2
              className="pi-section-title"
              style={{ marginBottom: 16 }}
            >
              Capacity Forecast
            </h2>
            <div className="pi-table-wrap">
              <table className="pi-table pi-table-dashboard">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Role</th>
                    <th style={{ textAlign: "right", width: 90 }}>
                      Demand HC
                    </th>
                    <th style={{ textAlign: "right", width: 90 }}>
                      Available HC
                    </th>
                    <th style={{ textAlign: "right", width: 80 }}>Net HC</th>
                    <th style={{ width: 90 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, i) => (
                    <tr key={i}>
                      <td
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.week_start_date}
                      </td>
                      <td>{row.labor_role}</td>
                      <td style={{ textAlign: "right" }}>
                        {row.demand_headcount}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {row.available_headcount}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: 600,
                          color:
                            Number(row.net_headcount ?? 0) < 0
                              ? "var(--bad)"
                              : "var(--text)",
                        }}
                      >
                        {row.net_headcount}
                      </td>
                      <td>
                        <span
                          className={
                            row.status === "red"
                              ? "pi-badge pi-badge-bad"
                              : row.status === "yellow"
                                ? "pi-badge pi-badge-warn"
                                : "pi-badge pi-badge-good"
                          }
                        >
                          {row.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
