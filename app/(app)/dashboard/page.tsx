"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ForecastRow = {
  tenant_id: string;
  week_start_date: string;
  labor_role: string;
  demand_headcount: number | string;
  available_headcount: number | string;
  net_headcount: number | string;
  status: "green" | "yellow" | "red";
};

type ProjectDemand = {
  project_id: string;
  project_number: string;
  project_name: string;
  week_start_date: string;
  labor_role: string;
  demand_headcount: number | string;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [projectDemand, setProjectDemand] = useState<ProjectDemand[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const forecast = await supabase
      .from("v_capacity_forecast_12w")
      .select("*")
      .order("week_start_date", { ascending: true })
      .limit(24);

    const projects = await supabase
      .from("v_project_labor_demand_12w")
      .select("*");

    if (forecast.error) {
      setError(forecast.error.message);
      setLoading(false);
      return;
    }

    if (projects.error) {
      setError(projects.error.message);
      setLoading(false);
      return;
    }

    setRows(forecast.data || []);
    setProjectDemand(projects.data || []);
    setLoading(false);
  }

  function statusColor(status: string) {
    if (status === "red") return "#ff4d4f";
    if (status === "yellow") return "#f5a623";
    return "#52c41a";
  }

  const shortages = rows.filter((r) => Number(r.net_headcount ?? 0) < 0);

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

  const installerRows = rows.filter((r) => r.labor_role === "Installer");

  const riskWeeks = new Set(
    installerRows
      .filter((r) => Number(r.net_headcount ?? 0) < 0)
      .map((r) => r.week_start_date),
  ).size;

  const maxInstallerShortage = installerRows.reduce((min, r) => {
    const net = Number(r.net_headcount ?? 0);
    return net < min ? net : min;
  }, 0);

  const installerDemand = installerRows.reduce((sum, r) => {
    return sum + Number(r.demand_headcount || 0);
  }, 0);

  function getProjectsForWeek(week: string, role: string) {
    return projectDemand.filter(
      (p) => p.week_start_date === week && p.labor_role === role,
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <header className="pi-page-header" style={{ marginBottom: 4 }}>
        <h1 className="pi-page-title" style={{ fontSize: 24, marginBottom: 6 }}>
          Capacity Dashboard
        </h1>
        <p className="pi-page-desc">
          Forecast and capacity issues for the next 8–12 weeks.
        </p>
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
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
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
              <div className="pi-stat-label">Risk Weeks</div>
              <div className="pi-stat-value" style={{ fontSize: 22 }}>
                {riskWeeks}
              </div>
            </div>
            <div
              className="pi-stat"
              style={{
                minWidth: 0,
                borderLeft:
                  maxInstallerShortage < 0
                    ? "3px solid var(--bad)"
                    : "3px solid var(--border)",
              }}
            >
              <div className="pi-stat-label">Max Installer Shortage</div>
              <div
                className="pi-stat-value"
                style={{
                  fontSize: 22,
                  color:
                    maxInstallerShortage < 0 ? "var(--bad)" : "var(--text)",
                }}
              >
                {maxInstallerShortage}
              </div>
            </div>
            <div
              className="pi-stat"
              style={{
                minWidth: 0,
                borderLeft: "3px solid var(--border)",
              }}
            >
              <div className="pi-stat-label">Installer Demand (8w)</div>
              <div className="pi-stat-value" style={{ fontSize: 22 }}>
                {installerDemand}
              </div>
            </div>
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

                  return (
                    <div
                      key={i}
                      style={{
                        padding: "12px 14px",
                        background: "rgba(0,0,0,0.2)",
                        borderRadius: "var(--r-sm)",
                        border: "1px solid var(--border-faint)",
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
                          {row.week_start_date}
                        </span>
                        {" · "}
                        <span>{row.labor_role}</span>
                        {" shortage "}
                        <span
                          style={{
                            color: "var(--bad)",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {row.net_headcount}
                        </span>
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
