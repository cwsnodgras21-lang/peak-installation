"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Exposure = {
  id: string;
  project_id: string;
  schedule_version_id: string | null;
  title: string | null;
  description: string | null;
  cause_type: string | null;
  estimated_labor_hours_delta: number | null;
  estimated_labor_cost_delta: number | null;
  estimated_material_cost_delta: number | null;
  status: string | null;
  created_at: string | null;
};

type ProjectRef = { id: string; project_number: string; name: string };

function statusBadgeClass(status: string | null): string {
  if (!status) return "pi-badge";
  const s = status.toLowerCase();
  if (s === "open") return "pi-badge pi-badge-warn";
  if (s === "closed") return "pi-badge pi-badge-good";
  if (s === "pending") return "pi-badge pi-badge-warn";
  return "pi-badge";
}

export default function ExposuresPage() {
  const [loading, setLoading] = useState(true);
  const [exposures, setExposures] = useState<Exposure[]>([]);
  const [projects, setProjects] = useState<Record<string, ProjectRef>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
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

    const { data: expData, error: expErr } = await supabase
      .from("financial_exposures")
      .select(
        "id, project_id, schedule_version_id, title, description, cause_type, " +
          "estimated_labor_hours_delta, estimated_labor_cost_delta, " +
          "estimated_material_cost_delta, status, created_at",
      )
      .order("created_at", { ascending: false });

    if (expErr) {
      setError(expErr.message);
      setLoading(false);
      return;
    }

    setExposures((expData ?? []) as Exposure[]);

    const projectIds = [...new Set((expData ?? []).map((e: Exposure) => e.project_id))];
    if (projectIds.length > 0) {
      const { data: projData } = await supabase
        .from("projects")
        .select("id, project_number, name")
        .in("id", projectIds);
      const map: Record<string, ProjectRef> = {};
      (projData ?? []).forEach((p: ProjectRef) => {
        map[p.id] = p;
      });
      setProjects(map);
    }

    setLoading(false);
  }

  function formatDate(value: string | null | undefined) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatCurrency(value: number | null | undefined) {
    if (value == null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  // KPI values (computed from existing data)
  const totalExposures = exposures.length;
  const openExposures = exposures.filter(
    (e) => (e.status ?? "").toLowerCase() === "open",
  ).length;
  const totalLaborHoursDelta = exposures.reduce(
    (sum, e) => sum + (e.estimated_labor_hours_delta ?? 0),
    0,
  );
  const hasLaborImpact = totalLaborHoursDelta !== 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <header className="pi-page-header" style={{ marginBottom: 4 }}>
        <h1 className="pi-page-title" style={{ fontSize: 24, marginBottom: 6 }}>
          Exposures
        </h1>
        <p className="pi-page-desc">
          Financial exposures from schedule revisions and scope changes.
        </p>
      </header>

      {error && (
        <p style={{ color: "var(--bad)", padding: "12px 0" }}>{error}</p>
      )}

      {loading ? (
        <p className="pi-page-desc" style={{ padding: "24px 0" }}>
          Loading…
        </p>
      ) : exposures.length === 0 ? (
        <div className="pi-empty" style={{ padding: 40, textAlign: "left" }}>
          <div className="pi-empty-title" style={{ marginBottom: 12 }}>
            No exposures yet
          </div>
          <p style={{ margin: "0 0 12px 0", color: "var(--muted)", lineHeight: 1.6 }}>
            Exposures track potential cost or schedule impact from changes to a project.
            They help you quantify risk when scope shifts or client requests affect the plan.
          </p>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
            In this system, exposures are created automatically when you mark a schedule
            revision as <strong style={{ color: "var(--text)" }}>client-driven</strong> on a
            project. Create a new schedule version and check that option to generate an exposure.
          </p>
        </div>
      ) : (
        <>
          {/* KPI summary */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 16,
            }}
          >
            <div
              className="pi-stat"
              style={{
                minWidth: 0,
                borderLeft: "3px solid var(--border)",
              }}
            >
              <div className="pi-stat-label">Total Exposures</div>
              <div className="pi-stat-value" style={{ fontSize: 22 }}>
                {totalExposures}
              </div>
            </div>
            <div
              className="pi-stat"
              style={{
                minWidth: 0,
                borderLeft:
                  openExposures > 0
                    ? "3px solid var(--warn)"
                    : "3px solid var(--border)",
              }}
            >
              <div className="pi-stat-label">Open</div>
              <div
                className="pi-stat-value"
                style={{
                  fontSize: 22,
                  color: openExposures > 0 ? "var(--warn)" : "var(--text)",
                }}
              >
                {openExposures}
              </div>
            </div>
            {hasLaborImpact && (
              <div
                className="pi-stat"
                style={{
                  minWidth: 0,
                  borderLeft: "3px solid var(--border)",
                }}
              >
                <div className="pi-stat-label">Labor Hrs Δ (total)</div>
                <div
                  className="pi-stat-value"
                  style={{
                    fontSize: 22,
                    color:
                      totalLaborHoursDelta > 0
                        ? "var(--bad)"
                        : totalLaborHoursDelta < 0
                          ? "var(--good)"
                          : "var(--text)",
                  }}
                >
                  {totalLaborHoursDelta > 0 ? "+" : ""}
                  {totalLaborHoursDelta}
                </div>
              </div>
            )}
          </section>

          {/* Exposures table */}
          <section className="pi-card-lift" style={{ overflow: "hidden" }}>
            <style>{`
              .exposures-table-row:hover td {
                background: rgba(255, 255, 255, 0.04) !important;
              }
              .exposures-project-link:hover div:first-child {
                color: var(--brand) !important;
              }
            `}</style>
            <h2 className="pi-section-title" style={{ marginBottom: 16 }}>
              All Exposures
            </h2>
            <div className="pi-table-wrap">
              <table className="pi-table pi-table-dashboard">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Title / Reason</th>
                    <th style={{ width: 100 }}>Status</th>
                    <th style={{ textAlign: "right", width: 90 }}>
                      Labor Hrs Δ
                    </th>
                    <th style={{ textAlign: "right", width: 100 }}>
                      Labor $ Δ
                    </th>
                    <th style={{ textAlign: "right", width: 100 }}>
                      Material $ Δ
                    </th>
                    <th style={{ width: 110 }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {exposures.map((e) => (
                    <tr key={e.id} className="exposures-table-row">
                      <td>
                        <Link
                          href={`/projects/${e.project_id}`}
                          className="exposures-project-link"
                          style={{
                            display: "block",
                            textDecoration: "none",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              color: "var(--text)",
                              fontSize: 14,
                            }}
                          >
                            {projects[e.project_id]?.project_number ??
                              e.project_id.slice(0, 8)}
                          </div>
                          {projects[e.project_id]?.name && (
                            <div
                              style={{
                                fontSize: 12,
                                color: "var(--muted)",
                                marginTop: 2,
                                fontWeight: 400,
                              }}
                            >
                              {projects[e.project_id].name}
                            </div>
                          )}
                        </Link>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {e.title ?? e.cause_type ?? "—"}
                        </div>
                        {e.description && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--muted)",
                              marginTop: 4,
                              maxWidth: 280,
                              lineHeight: 1.4,
                            }}
                          >
                            {e.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className={statusBadgeClass(e.status)}
                          style={{
                            textTransform: "capitalize",
                          }}
                        >
                          {e.status ?? "—"}
                        </span>
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                          color:
                            (e.estimated_labor_hours_delta ?? 0) > 0
                              ? "var(--bad)"
                              : (e.estimated_labor_hours_delta ?? 0) < 0
                                ? "var(--good)"
                                : "var(--text)",
                        }}
                      >
                        {e.estimated_labor_hours_delta != null
                          ? (e.estimated_labor_hours_delta > 0 ? "+" : "") +
                            e.estimated_labor_hours_delta
                          : "—"}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatCurrency(e.estimated_labor_cost_delta)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatCurrency(e.estimated_material_cost_delta)}
                      </td>
                      <td
                        style={{
                          fontSize: 13,
                          color: "var(--muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDate(e.created_at)}
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
