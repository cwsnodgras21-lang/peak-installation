"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────
type CapacityShortageRow = {
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

type ExposureReportRow = {
  id: string;
  project_id: string;
  title: string | null;
  cause_type: string | null;
  status: string | null;
  estimated_labor_cost_delta: number | null;
  estimated_material_cost_delta: number | null;
  created_at: string | null;
  projects: { project_number: string; name: string } | null;
};

type LaborWeekRow = {
  headcount: number | null;
  hours_st: number | null;
  hours_ot: number | null;
  schedule_versions: {
    project_id: string;
    is_current: boolean;
    projects: { project_number: string; name: string } | null;
  } | null;
};

type ProjectLaborRow = {
  project_id: string;
  project_number: string;
  project_name: string;
  sum_headcount: number;
  sum_hours_st: number;
  sum_hours_ot: number;
  sum_total_hours: number;
  open_exposures_count: number;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
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
  if (value == null) return "—";
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

function escapeCsv(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsvRow(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCsv).join(",");
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shortageRows, setShortageRows] = useState<CapacityShortageRow[]>([]);
  const [exposureRows, setExposureRows] = useState<ExposureReportRow[]>([]);
  const [laborRows, setLaborRows] = useState<ProjectLaborRow[]>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
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

    const [forecastRes, expRes, laborRes, exposuresForCount] = await Promise.all([
      supabase
        .from("v_capacity_forecast_12w")
        .select(
          "tenant_id, week_start_date, labor_role, demand_hours, available_hours, net_hours, " +
            "demand_headcount, available_headcount, net_headcount, status",
        )
        .eq("tenant_id", tid)
        .order("week_start_date", { ascending: true })
        .order("labor_role", { ascending: true }),
      supabase
        .from("financial_exposures")
        .select(
          "id, project_id, title, cause_type, status, estimated_labor_cost_delta, " +
            "estimated_material_cost_delta, created_at, projects(project_number, name)",
        )
        .eq("tenant_id", tid)
        .order("created_at", { ascending: false }),
      supabase
        .from("schedule_labor_weeks")
        .select(
          "headcount, hours_st, hours_ot, schedule_versions(project_id, is_current, projects(project_number, name))",
        )
        .eq("tenant_id", tid),
      supabase
        .from("financial_exposures")
        .select("project_id, status")
        .eq("tenant_id", tid),
    ]);

    if (forecastRes.error) {
      setError(forecastRes.error.message);
      setLoading(false);
      return;
    }
    if (expRes.error) {
      setError(expRes.error.message);
      setLoading(false);
      return;
    }
    if (laborRes.error) {
      setError(laborRes.error.message);
      setLoading(false);
      return;
    }

    // Section 1: Filter shortage rows (net_hours < 0 OR net_headcount < 0), limit to 12 weeks
    const allForecast = (forecastRes.data ?? []) as CapacityShortageRow[];
    const weeks = [...new Set(allForecast.map((r) => r.week_start_date))].sort();
    const next12Weeks = weeks.slice(0, 12);
    const shortageFiltered = allForecast.filter(
      (r) =>
        (Number(r.net_hours ?? 0) < 0 || Number(r.net_headcount ?? 0) < 0) &&
        next12Weeks.includes(r.week_start_date),
    );
    setShortageRows(shortageFiltered);

    // Section 2: Exposure report
    setExposureRows((expRes.data ?? []) as ExposureReportRow[]);

    // Section 3: Aggregate labor by project (current version only), count open exposures
    const laborWeeks = (laborRes.data ?? []) as LaborWeekRow[];
    const openCountByProject: Record<string, number> = {};
    ((exposuresForCount.data ?? []) as { project_id: string; status: string }[]).forEach(
      (e) => {
        if ((e.status ?? "").toLowerCase() === "open") {
          openCountByProject[e.project_id] =
            (openCountByProject[e.project_id] ?? 0) + 1;
        }
      },
    );

    const agg: Record<
      string,
      {
        project_number: string;
        project_name: string;
        headcount: number;
        hours_st: number;
        hours_ot: number;
      }
    > = {};
    laborWeeks.forEach((w) => {
      const sv = w.schedule_versions;
      if (!sv?.is_current || !sv.project_id) return;
      const proj = sv.projects;
      const pid = sv.project_id;
      if (!agg[pid]) {
        agg[pid] = {
          project_number: proj?.project_number ?? pid.slice(0, 8),
          project_name: proj?.name ?? "—",
          headcount: 0,
          hours_st: 0,
          hours_ot: 0,
        };
      }
      agg[pid].headcount += Number(w.headcount ?? 0);
      agg[pid].hours_st += Number(w.hours_st ?? 0);
      agg[pid].hours_ot += Number(w.hours_ot ?? 0);
    });

    const laborAggRows: ProjectLaborRow[] = Object.entries(agg).map(
      ([project_id, v]) => ({
        project_id,
        project_number: v.project_number,
        project_name: v.project_name,
        sum_headcount: v.headcount,
        sum_hours_st: v.hours_st,
        sum_hours_ot: v.hours_ot,
        sum_total_hours: v.hours_st + v.hours_ot,
        open_exposures_count: openCountByProject[project_id] ?? 0,
      }),
    );
    laborAggRows.sort((a, b) =>
      a.project_number.localeCompare(b.project_number),
    );
    setLaborRows(laborAggRows);

    setLoading(false);
  }

  // Track active section for nav highlight
  useEffect(() => {
    const ids = [
      "capacity-shortage-report",
      "exposure-financial-report",
      "project-labor-demand-report",
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveSection(e.target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [loading]);

  const totalLaborExposure = exposureRows.reduce(
    (s, e) => s + (e.estimated_labor_cost_delta ?? 0),
    0,
  );
  const totalMaterialExposure = exposureRows.reduce(
    (s, e) => s + (e.estimated_material_cost_delta ?? 0),
    0,
  );
  const totalCombinedExposure = totalLaborExposure + totalMaterialExposure;

  const today = new Date().toISOString().slice(0, 10);

  function exportCapacityShortage() {
    const headers = [
      "Week",
      "Role",
      "Demand Hrs",
      "Avail Hrs",
      "Net Hrs",
      "Dem HC",
      "Avail HC",
      "Net HC",
      "Status",
    ];
    const rows = shortageRows.map((r) =>
      toCsvRow([
        formatWeekLabel(r.week_start_date),
        r.labor_role,
        r.demand_hours != null ? Number(r.demand_hours).toFixed(0) : "",
        r.available_hours != null ? Number(r.available_hours).toFixed(0) : "",
        r.net_hours != null ? Number(r.net_hours).toFixed(0) : "",
        r.demand_headcount ?? "",
        r.available_headcount ?? "",
        r.net_headcount ?? "",
        r.status ?? "",
      ]),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    downloadCsv(csv, `capacity-shortage-report-${today}.csv`);
    setExportToast("CSV downloaded.");
  }

  function exportExposureFinancial() {
    const headers = [
      "Project",
      "Title",
      "Cause",
      "Status",
      "Labor Delta",
      "Material Delta",
      "Total Delta",
      "Created",
    ];
    const rows = exposureRows.map((e) => {
      const labor = e.estimated_labor_cost_delta ?? 0;
      const material = e.estimated_material_cost_delta ?? 0;
      const total = labor + material;
      const proj = e.projects;
      return toCsvRow([
        proj?.project_number ?? e.project_id.slice(0, 8),
        e.title ?? "",
        e.cause_type ?? "",
        e.status ?? "",
        labor,
        material,
        total,
        e.created_at ? formatDate(e.created_at) : "",
      ]);
    });
    const csv = [headers.join(","), ...rows].join("\n");
    downloadCsv(csv, `exposure-financial-report-${today}.csv`);
    setExportToast("CSV downloaded.");
  }

  function exportProjectLabor() {
    const headers = [
      "Project",
      "Project Name",
      "Sum Headcount",
      "Sum ST Hrs",
      "Sum OT Hrs",
      "Sum Total Hrs",
      "Open Exposures",
    ];
    const rows = laborRows.map((r) =>
      toCsvRow([
        r.project_number,
        r.project_name ?? "",
        r.sum_headcount,
        r.sum_hours_st,
        r.sum_hours_ot,
        r.sum_total_hours,
        r.open_exposures_count,
      ]),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    downloadCsv(csv, `project-labor-demand-report-${today}.csv`);
    setExportToast("CSV downloaded.");
  }

  useEffect(() => {
    if (!exportToast) return;
    const t = setTimeout(() => setExportToast(null), 2000);
    return () => clearTimeout(t);
  }, [exportToast]);

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
            Reports
          </h1>
          <p className="pi-page-desc">
            Capacity shortage, exposure financial, and project labor demand reports.
          </p>
        </div>
        <Link
          href="/help#common-tasks"
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

      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--bg)",
          padding: "12px 0 16px",
          marginBottom: 8,
          borderBottom: "1px solid var(--border-faint)",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <a
          href="#capacity-shortage-report"
          style={{
            padding: "8px 14px",
            borderRadius: "var(--r-xs)",
            border: "1px solid var(--border)",
            background:
              activeSection === "capacity-shortage-report"
                ? "rgba(255, 140, 0, 0.18)"
                : "rgba(0,0,0,0.2)",
            color: "var(--text)",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            if (activeSection !== "capacity-shortage-report") {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.borderColor = "var(--border)";
            }
          }}
          onMouseLeave={(e) => {
            if (activeSection !== "capacity-shortage-report") {
              e.currentTarget.style.background = "rgba(0,0,0,0.2)";
              e.currentTarget.style.borderColor = "var(--border)";
            }
          }}
        >
          Capacity Shortages
        </a>
        <a
          href="#exposure-financial-report"
          style={{
            padding: "8px 14px",
            borderRadius: "var(--r-xs)",
            border: "1px solid var(--border)",
            background:
              activeSection === "exposure-financial-report"
                ? "rgba(255, 140, 0, 0.18)"
                : "rgba(0,0,0,0.2)",
            color: "var(--text)",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            if (activeSection !== "exposure-financial-report") {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.borderColor = "var(--border)";
            }
          }}
          onMouseLeave={(e) => {
            if (activeSection !== "exposure-financial-report") {
              e.currentTarget.style.background = "rgba(0,0,0,0.2)";
              e.currentTarget.style.borderColor = "var(--border)";
            }
          }}
        >
          Exposure Financial
        </a>
        <a
          href="#project-labor-demand-report"
          style={{
            padding: "8px 14px",
            borderRadius: "var(--r-xs)",
            border: "1px solid var(--border)",
            background:
              activeSection === "project-labor-demand-report"
                ? "rgba(255, 140, 0, 0.18)"
                : "rgba(0,0,0,0.2)",
            color: "var(--text)",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            if (activeSection !== "project-labor-demand-report") {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.borderColor = "var(--border)";
            }
          }}
          onMouseLeave={(e) => {
            if (activeSection !== "project-labor-demand-report") {
              e.currentTarget.style.background = "rgba(0,0,0,0.2)";
              e.currentTarget.style.borderColor = "var(--border)";
            }
          }}
        >
          Project Labor
        </a>
      </nav>

      {loading && (
        <p className="pi-page-desc" style={{ padding: "24px 0" }}>
          Loading reports…
        </p>
      )}
      {error && (
        <p style={{ color: "var(--bad)", padding: "12px 0" }}>{error}</p>
      )}

      {exportToast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            padding: "10px 16px",
            background: "var(--good)",
            color: "var(--bg)",
            borderRadius: "var(--r-sm)",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            zIndex: 100,
          }}
        >
          {exportToast}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Section 1: Capacity Shortage Report */}
          <section
            id="capacity-shortage-report"
            className="pi-card-lift"
            style={{ overflow: "hidden", scrollMarginTop: 80 }}
          >
            <h2
              className="pi-section-title"
              style={{
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              Capacity Shortage Report
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  onClick={exportCapacityShortage}
                  className="pi-btn pi-btn-sm"
                >
                  Export CSV
                </button>
                <Link
                  href="/dashboard"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--brand)",
                    textDecoration: "none",
                  }}
                >
                  Dashboard →
                </Link>
              </span>
            </h2>
            {shortageRows.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                No capacity shortages in the next 12 weeks.
              </p>
            ) : (
              <div className="pi-table-wrap">
                <table className="pi-table pi-table-dashboard">
                  <thead>
                    <tr>
                      <th>Week</th>
                      <th>Role</th>
                      <th style={{ textAlign: "right", width: 90 }}>
                        Demand Hrs
                      </th>
                      <th style={{ textAlign: "right", width: 90 }}>
                        Avail Hrs
                      </th>
                      <th style={{ textAlign: "right", width: 80 }}>Net Hrs</th>
                      <th style={{ textAlign: "right", width: 80 }}>Dem HC</th>
                      <th style={{ textAlign: "right", width: 80 }}>Avail HC</th>
                      <th style={{ textAlign: "right", width: 80 }}>Net HC</th>
                      <th style={{ width: 90 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shortageRows.map((row, i) => (
                      <tr key={i}>
                        <td
                          style={{
                            fontVariantNumeric: "tabular-nums",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatWeekLabel(row.week_start_date)}
                        </td>
                        <td>{row.labor_role}</td>
                        <td style={{ textAlign: "right" }}>
                          {row.demand_hours != null
                            ? Number(row.demand_hours).toFixed(0)
                            : "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {row.available_hours != null
                            ? Number(row.available_hours).toFixed(0)
                            : "—"}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 600,
                            color:
                              Number(row.net_hours ?? 0) < 0
                                ? "var(--bad)"
                                : "var(--text)",
                          }}
                        >
                          {row.net_hours != null
                            ? Number(row.net_hours).toFixed(0)
                            : "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {row.demand_headcount ?? "—"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {row.available_headcount ?? "—"}
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
                          {row.net_headcount ?? "—"}
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
                            {(row.status ?? "—").toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Section 2: Exposure Financial Report */}
          <section
            id="exposure-financial-report"
            className="pi-card-lift"
            style={{ overflow: "hidden", scrollMarginTop: 80 }}
          >
            <h2
              className="pi-section-title"
              style={{
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              Exposure Financial Report
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  onClick={exportExposureFinancial}
                  className="pi-btn pi-btn-sm"
                >
                  Export CSV
                </button>
                <Link
                  href="/exposures"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--brand)",
                    textDecoration: "none",
                  }}
                >
                  Exposures →
                </Link>
              </span>
            </h2>
            {exposureRows.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                No exposures on record.
              </p>
            ) : (
              <>
                <div className="pi-table-wrap">
                  <table className="pi-table pi-table-dashboard">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Title</th>
                        <th style={{ width: 100 }}>Cause</th>
                        <th style={{ width: 90 }}>Status</th>
                        <th style={{ textAlign: "right", width: 110 }}>
                          Labor $ Δ
                        </th>
                        <th style={{ textAlign: "right", width: 110 }}>
                          Material $ Δ
                        </th>
                        <th style={{ textAlign: "right", width: 110 }}>
                          Total Δ
                        </th>
                        <th style={{ width: 100 }}>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exposureRows.map((e) => {
                        const labor = e.estimated_labor_cost_delta ?? 0;
                        const material = e.estimated_material_cost_delta ?? 0;
                        const total = labor + material;
                        const proj = e.projects;
                        return (
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
                                {proj?.project_number ?? e.project_id.slice(0, 8)}
                              </Link>
                              {proj?.name && (
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "var(--muted)",
                                    fontWeight: 400,
                                  }}
                                >
                                  {proj.name}
                                </div>
                              )}
                            </td>
                            <td>{e.title ?? "—"}</td>
                            <td style={{ fontSize: 13, color: "var(--muted)" }}>
                              {e.cause_type ?? "—"}
                            </td>
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
                            <td
                              style={{
                                textAlign: "right",
                                fontWeight: 600,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {formatCurrency(total)}
                            </td>
                            <td style={{ fontSize: 13, color: "var(--muted)" }}>
                              {formatDate(e.created_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div
                  style={{
                    marginTop: 16,
                    padding: "12px 16px",
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: "var(--r-sm)",
                    border: "1px solid var(--border-faint)",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "16px 24px",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        display: "block",
                      }}
                    >
                      Total Labor Exposure
                    </span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "var(--text)",
                      }}
                    >
                      {formatCurrency(totalLaborExposure)}
                    </span>
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        display: "block",
                      }}
                    >
                      Total Material Exposure
                    </span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "var(--text)",
                      }}
                    >
                      {formatCurrency(totalMaterialExposure)}
                    </span>
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        display: "block",
                      }}
                    >
                      Total Combined Exposure
                    </span>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color:
                          totalCombinedExposure > 0 ? "var(--warn)" : "var(--text)",
                      }}
                    >
                      {formatCurrency(totalCombinedExposure)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Section 3: Project Labor Demand Report */}
          <section
            id="project-labor-demand-report"
            className="pi-card-lift"
            style={{ overflow: "hidden", scrollMarginTop: 80 }}
          >
            <h2
              className="pi-section-title"
              style={{
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              Project Labor Demand Report
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  onClick={exportProjectLabor}
                  className="pi-btn pi-btn-sm"
                >
                  Export CSV
                </button>
                <Link
                  href="/projects"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--brand)",
                    textDecoration: "none",
                  }}
                >
                  Projects →
                </Link>
              </span>
            </h2>
            {laborRows.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                No project labor data (current schedule versions).
              </p>
            ) : (
              <div className="pi-table-wrap">
                <table className="pi-table pi-table-dashboard">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th style={{ textAlign: "right", width: 90 }}>
                        Σ Headcount
                      </th>
                      <th style={{ textAlign: "right", width: 90 }}>
                        Σ ST Hrs
                      </th>
                      <th style={{ textAlign: "right", width: 90 }}>
                        Σ OT Hrs
                      </th>
                      <th style={{ textAlign: "right", width: 100 }}>
                        Σ Total Hrs
                      </th>
                      <th style={{ textAlign: "center", width: 90 }}>
                        Open Exposures
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {laborRows.map((r) => (
                      <tr key={r.project_id}>
                        <td>
                          <Link
                            href={`/projects/${r.project_id}`}
                            style={{
                              fontWeight: 600,
                              color: "var(--text)",
                              textDecoration: "none",
                            }}
                          >
                            {r.project_number}
                          </Link>
                          {r.project_name && (
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--muted)",
                                fontWeight: 400,
                              }}
                            >
                              {r.project_name}
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {r.sum_headcount}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {r.sum_hours_st}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {r.sum_hours_ot}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                          }}
                        >
                          {r.sum_total_hours}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {r.open_exposures_count > 0 ? (
                            <span className="pi-badge pi-badge-warn">
                              {r.open_exposures_count}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 13,
                                color: "var(--muted)",
                              }}
                            >
                              {r.open_exposures_count}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
