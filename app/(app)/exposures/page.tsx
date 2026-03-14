"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { EditExposureModal } from "../components/EditExposureModal";
import {
  CreateChangeOrderModal,
  type PrefillFromExposure,
} from "../components/CreateChangeOrderModal";

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

function coStatusBadgeClass(status: string | null): string {
  if (!status) return "pi-badge";
  const s = status.toLowerCase();
  if (s === "approved" || s === "billed") return "pi-badge pi-badge-good";
  if (s === "submitted" || s === "draft") return "pi-badge pi-badge-warn";
  if (s === "cancelled") return "pi-badge pi-badge-bad";
  return "pi-badge";
}

type StatusFilter = "all" | "open" | "pending" | "closed";

const EXPOSURE_STATUSES = ["open", "pending", "closed"] as const;

export default function ExposuresPage() {
  const [loading, setLoading] = useState(true);
  const [exposures, setExposures] = useState<Exposure[]>([]);
  const [projects, setProjects] = useState<Record<string, ProjectRef>>({});
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [exposureToast, setExposureToast] = useState<string | null>(null);
  const [editingExposure, setEditingExposure] = useState<Exposure | null>(null);
  const [editingExposureSaving, setEditingExposureSaving] = useState(false);
  const [editingExposureError, setEditingExposureError] = useState<string | null>(
    null,
  );
  const [editingExposureCurrentVersionId, setEditingExposureCurrentVersionId] =
    useState<string | null>(null);
  const [editingExposureLinkedLabel, setEditingExposureLinkedLabel] = useState<
    string | null
  >(null);
  const [createCOFromExposure, setCreateCOFromExposure] =
    useState<Exposure | null>(null);
  const [createCOSaving, setCreateCOSaving] = useState(false);
  const [createCOError, setCreateCOError] = useState<string | null>(null);
  const [coByExposureId, setCoByExposureId] = useState<
    Record<string, { co_number: string; id: string; status: string }>
  >({});

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
    setTenantId(profile.tenant_id);

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

    const { data: coData } = await supabase
      .from("change_orders")
      .select("id, co_number, financial_exposure_id, status")
      .not("financial_exposure_id", "is", null);
    const coMap: Record<string, { co_number: string; id: string; status: string }> = {};
    ((coData ?? []) as { financial_exposure_id: string; co_number: string; id: string; status: string }[]).forEach(
      (c) => {
        if (c.financial_exposure_id)
          coMap[c.financial_exposure_id] = {
            co_number: c.co_number,
            id: c.id,
            status: c.status ?? "draft",
          };
      },
    );
    setCoByExposureId(coMap);

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

  async function openEditExposure(exp: Exposure) {
    setEditingExposureError(null);
    setEditingExposure(exp);
    setEditingExposureLinkedLabel(null);
    setEditingExposureCurrentVersionId(null);
    const { data: versions } = await supabase
      .from("schedule_versions")
      .select("id, version_number, is_current")
      .eq("project_id", exp.project_id)
      .order("version_number", { ascending: false });
    const current = (versions ?? []).find((v: { is_current: boolean }) => v.is_current);
    const linked = exp.schedule_version_id
      ? (versions ?? []).find((v: { id: string }) => v.id === exp.schedule_version_id)
      : null;
    setEditingExposureCurrentVersionId(current?.id ?? null);
    setEditingExposureLinkedLabel(linked ? `v${linked.version_number}` : null);
  }

  async function handleEditExposure(draft: {
    title: string;
    cause_type: string;
    laborHoursDelta: string;
    laborCostDelta: string;
    materialCostDelta: string;
    scheduleVersionChoice: "keep" | "attach" | "clear";
  }) {
    if (!tenantId || !editingExposure) return;
    setEditingExposureSaving(true);
    setEditingExposureError(null);
    let scheduleVersionId: string | null = editingExposure.schedule_version_id;
    if (draft.scheduleVersionChoice === "attach" && editingExposureCurrentVersionId)
      scheduleVersionId = editingExposureCurrentVersionId;
    else if (draft.scheduleVersionChoice === "clear")
      scheduleVersionId = null;
    const { error } = await supabase
      .from("financial_exposures")
      .update({
        title: draft.title,
        cause_type: draft.cause_type,
        estimated_labor_hours_delta: numOrNull(draft.laborHoursDelta) ?? 0,
        estimated_labor_cost_delta: numOrNull(draft.laborCostDelta) ?? 0,
        estimated_material_cost_delta: numOrNull(draft.materialCostDelta) ?? 0,
        schedule_version_id: scheduleVersionId,
      })
      .eq("id", editingExposure.id)
      .eq("tenant_id", tenantId);
    setEditingExposureSaving(false);
    if (error) {
      setEditingExposureError(error.message);
      return;
    }
    setEditingExposure(null);
    setExposureToast("Exposure updated.");
    setTimeout(() => setExposureToast(null), 4000);
    await load();
  }

  function numOrNull(val: string): number | null {
    if (val === "" || val == null) return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  }

  async function handleCreateCOFromExposure(draft: {
    project_id: string;
    financial_exposure_id: string | null;
    co_number: string;
    title: string;
    status: string;
    amount: string;
  }) {
    if (!tenantId) return;
    setCreateCOSaving(true);
    setCreateCOError(null);
    const amountNum = Number(draft.amount);
    const { error } = await supabase.from("change_orders").insert({
      tenant_id: tenantId,
      project_id: draft.project_id,
      financial_exposure_id: draft.financial_exposure_id || null,
      co_number: draft.co_number,
      title: draft.title,
      status: draft.status,
      amount: isNaN(amountNum) ? 0 : Math.max(0, amountNum),
    });
    setCreateCOSaving(false);
    if (error) {
      setCreateCOError(error.message);
      return;
    }
    setCreateCOFromExposure(null);
    setExposureToast("Change order created from exposure.");
    setTimeout(() => setExposureToast(null), 4000);
    await load();
  }

  async function updateExposureStatus(expId: string, newStatus: string) {
    if (!tenantId || !EXPOSURE_STATUSES.includes(newStatus as (typeof EXPOSURE_STATUSES)[number]))
      return;
    setStatusUpdatingId(expId);
    const { error } = await supabase
      .from("financial_exposures")
      .update({ status: newStatus })
      .eq("id", expId)
      .eq("tenant_id", tenantId);
    setStatusUpdatingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setExposureToast("Exposure status updated.");
    setTimeout(() => setExposureToast(null), 4000);
    await load();
  }

  // Filter exposures client-side (KPIs stay on full dataset)
  const filteredExposures =
    statusFilter === "all"
      ? exposures
      : exposures.filter(
          (e) => (e.status ?? "").toLowerCase() === statusFilter,
        );

  // KPI values (computed from full dataset, not filtered)
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
      {createCOFromExposure && (
        <CreateChangeOrderModal
          projects={Object.values(projects)}
          exposures={exposures.map((x) => ({
            id: x.id,
            project_id: x.project_id,
            title: x.title,
          }))}
          selectedProjectId={createCOFromExposure.project_id}
          prefillFromExposure={{
            id: createCOFromExposure.id,
            project_id: createCOFromExposure.project_id,
            title: createCOFromExposure.title,
            estimated_labor_cost_delta: createCOFromExposure.estimated_labor_cost_delta,
            estimated_material_cost_delta:
              createCOFromExposure.estimated_material_cost_delta,
          }}
          saving={createCOSaving}
          error={createCOError}
          onSave={handleCreateCOFromExposure}
          onCancel={() => {
            setCreateCOFromExposure(null);
            setCreateCOError(null);
          }}
        />
      )}
      {editingExposure && (
        <EditExposureModal
          exposure={editingExposure}
          currentVersionId={editingExposureCurrentVersionId}
          linkedVersionLabel={editingExposureLinkedLabel}
          saving={editingExposureSaving}
          error={editingExposureError}
          onSave={handleEditExposure}
          onCancel={() => {
            setEditingExposure(null);
            setEditingExposureError(null);
          }}
        />
      )}
      {exposureToast && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 90,
            background: "var(--panel-lift)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "12px 20px",
            fontSize: 13,
            color: "var(--text)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {exposureToast}
        </div>
      )}
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
            Exposures
          </h1>
          <p className="pi-page-desc">
            Financial exposures from schedule revisions and scope changes.
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                className="pi-input"
                style={{
                  width: "auto",
                  minWidth: 120,
                  cursor: "pointer",
                }}
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
              </select>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                {filteredExposures.length} of {exposures.length}
              </span>
            </div>
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
                    <th style={{ width: 120 }}>CO</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExposures.map((e) => (
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
                        <select
                          value={
                            ["open", "pending", "closed"].includes(
                              (e.status ?? "").toLowerCase(),
                            )
                              ? (e.status ?? "").toLowerCase()
                              : "open"
                          }
                          onChange={(ev) => {
                            const v = ev.target.value;
                            if (v && ["open", "pending", "closed"].includes(v))
                              updateExposureStatus(e.id, v);
                          }}
                          disabled={statusUpdatingId === e.id}
                          className={statusBadgeClass(e.status)}
                          style={{
                            padding: "4px 8px",
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "capitalize",
                            border: "1px solid rgba(0,0,0,0.15)",
                            borderRadius: 4,
                            cursor:
                              statusUpdatingId === e.id ? "not-allowed" : "pointer",
                            minWidth: 90,
                          }}
                        >
                          <option value="open">Open</option>
                          <option value="pending">Pending</option>
                          <option value="closed">Closed</option>
                        </select>
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
                      <td>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          {coByExposureId[e.id] ? (
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <Link
                                href="/change-orders"
                                title="Linked change order"
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "var(--brand)",
                                  textDecoration: "none",
                                }}
                              >
                                {coByExposureId[e.id].co_number}
                              </Link>
                              <span
                                className={coStatusBadgeClass(coByExposureId[e.id].status)}
                                style={{
                                  padding: "2px 6px",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.05em",
                                  textTransform: "uppercase",
                                }}
                              >
                                {coByExposureId[e.id].status}
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setCreateCOError(null);
                                setCreateCOFromExposure(e);
                              }}
                              style={{
                                padding: "4px 8px",
                                fontSize: 11,
                                fontWeight: 600,
                                background: "transparent",
                                color: "var(--brand)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--r-xs)",
                                cursor: "pointer",
                              }}
                            >
                              Create CO
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditExposure(e)}
                            style={{
                              padding: "4px 10px",
                              fontSize: 12,
                              fontWeight: 600,
                              background: "transparent",
                              color: "var(--brand)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--r-sm)",
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>
                        </div>
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
