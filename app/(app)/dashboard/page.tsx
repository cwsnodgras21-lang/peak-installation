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

  function getProjectsForWeek(week: string) {
    return projectDemand.filter(
      (p) => p.week_start_date === week && p.labor_role === "Installer",
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Capacity Dashboard</h1>

      {loading && <p>Loading forecast...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && (
        <>
          {/* KPI BAR */}

          <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
            <div
              style={{
                background: "#1a1a1a",
                padding: 16,
                border: "1px solid #333",
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>Risk Weeks</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{riskWeeks}</div>
            </div>

            <div
              style={{
                background: "#1a1a1a",
                padding: 16,
                border: "1px solid #333",
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Max Installer Shortage
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {maxInstallerShortage}
              </div>
            </div>

            <div
              style={{
                background: "#1a1a1a",
                padding: 16,
                border: "1px solid #333",
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Installer Demand (8w)
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                {installerDemand}
              </div>
            </div>
          </div>

          {/* CAPACITY ISSUES */}

          {shortages.length > 0 && (
            <div
              style={{
                background: "#1a1a1a",
                padding: 16,
                borderRadius: 6,
                marginBottom: 24,
                border: "1px solid #333",
              }}
            >
              <h2 style={{ marginBottom: 10 }}>⚠ Capacity Issues</h2>

              {shortages.map((row, i) => {
                const projects =
                  row.labor_role === "Installer"
                    ? getProjectsForWeek(row.week_start_date)
                    : [];

                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div>
                      <strong>{row.week_start_date}</strong> — {row.labor_role}{" "}
                      shortage ({row.net_headcount})
                    </div>

                    {projects.map((p, idx) => (
                      <div
                        key={idx}
                        style={{ paddingLeft: 12, fontSize: 13, opacity: 0.9 }}
                      >
                        {p.project_number} — {p.project_name} →{" "}
                        {p.demand_headcount} installers
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* FORECAST TABLE */}

          <h2 style={{ marginBottom: 10 }}>Capacity Forecast</h2>

          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #333" }}>
                <th align="left">Week</th>
                <th align="left">Role</th>
                <th align="right">Demand HC</th>
                <th align="right">Available HC</th>
                <th align="right">Net HC</th>
                <th align="left">Status</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                  <td>{row.week_start_date}</td>
                  <td>{row.labor_role}</td>
                  <td align="right">{row.demand_headcount}</td>
                  <td align="right">{row.available_headcount}</td>
                  <td align="right">{row.net_headcount}</td>
                  <td>
                    <span
                      style={{
                        color: statusColor(row.status),
                        fontWeight: 600,
                      }}
                    >
                      {row.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
