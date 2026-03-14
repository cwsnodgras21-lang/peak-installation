"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  CreateChangeOrderModal,
  type ProjectRef,
  type ExposureRef,
} from "../components/CreateChangeOrderModal";
import { EditChangeOrderModal } from "../components/EditChangeOrderModal";

// ─── Types ────────────────────────────────────────────────────────────────────
type ChangeOrder = {
  id: string;
  tenant_id: string;
  project_id: string;
  financial_exposure_id: string | null;
  co_number: string;
  title: string;
  status: string;
  amount: number;
  created_at: string;
  updated_at: string;
  projects?: { project_number: string; name: string } | null;
};

const CO_STATUSES = ["draft", "submitted", "approved", "billed", "cancelled"] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────
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

function statusBadgeClass(status: string): string {
  const s = (status ?? "").toLowerCase();
  if (s === "approved" || s === "billed") return "pi-badge pi-badge-good";
  if (s === "submitted" || s === "draft") return "pi-badge pi-badge-warn";
  if (s === "cancelled") return "pi-badge pi-badge-bad";
  return "pi-badge";
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ChangeOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [exposures, setExposures] = useState<ExposureRef[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [editingChangeOrder, setEditingChangeOrder] =
    useState<ChangeOrder | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
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
    setTenantId(profile.tenant_id);

    const [coRes, projRes, expRes] = await Promise.all([
      supabase
        .from("change_orders")
        .select(
          "id, tenant_id, project_id, financial_exposure_id, co_number, title, status, amount, created_at, updated_at, projects(project_number, name)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("projects")
        .select("id, project_number, name")
        .eq("tenant_id", profile.tenant_id)
        .eq("status", "active")
        .order("project_number", { ascending: true }),
      supabase
        .from("financial_exposures")
        .select("id, project_id, title")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false }),
    ]);

    if (coRes.error) {
      setError(coRes.error.message);
      setLoading(false);
      return;
    }
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

    setChangeOrders((coRes.data ?? []) as unknown as ChangeOrder[]);
    setProjects((projRes.data ?? []) as ProjectRef[]);
    setExposures((expRes.data ?? []) as ExposureRef[]);
    setLoading(false);
  }

  async function handleCreateChangeOrder(draft: {
    project_id: string;
    financial_exposure_id: string | null;
    co_number: string;
    title: string;
    status: string;
    amount: string;
  }) {
    if (!tenantId) return;
    setCreateSaving(true);
    setCreateError(null);

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

    setCreateSaving(false);
    if (error) {
      setCreateError(error.message);
      return;
    }

    setShowCreateModal(false);
    setToast("Change order created.");
    setTimeout(() => setToast(null), 4000);
    await load();
  }

  async function handleEditChangeOrder(draft: {
    co_number: string;
    title: string;
    financial_exposure_id: string | null;
    amount: string;
  }) {
    if (!editingChangeOrder || !tenantId) return;
    setEditSaving(true);
    setEditError(null);
    const amountNum = Number(draft.amount);
    const { error } = await supabase
      .from("change_orders")
      .update({
        co_number: draft.co_number,
        title: draft.title,
        financial_exposure_id: draft.financial_exposure_id || null,
        amount: isNaN(amountNum) ? 0 : Math.max(0, amountNum),
      })
      .eq("id", editingChangeOrder.id)
      .eq("tenant_id", tenantId);
    setEditSaving(false);
    if (error) {
      setEditError(error.message);
      return;
    }
    setEditingChangeOrder(null);
    setToast("Change order updated.");
    setTimeout(() => setToast(null), 4000);
    await load();
  }

  async function updateChangeOrderStatus(coId: string, newStatus: string) {
    if (!tenantId || !CO_STATUSES.includes(newStatus as (typeof CO_STATUSES)[number]))
      return;
    setStatusUpdatingId(coId);
    const { error } = await supabase
      .from("change_orders")
      .update({ status: newStatus })
      .eq("id", coId)
      .eq("tenant_id", tenantId);
    setStatusUpdatingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setToast("Change order status updated.");
    setTimeout(() => setToast(null), 4000);
    await load();
  }

  // KPIs
  const openCount = changeOrders.filter((c) =>
    ["draft", "submitted"].includes((c.status ?? "").toLowerCase()),
  ).length;
  const pendingApprovalValue = changeOrders
    .filter((c) => (c.status ?? "").toLowerCase() === "submitted")
    .reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const approvedNotBilledValue = changeOrders
    .filter((c) => (c.status ?? "").toLowerCase() === "approved")
    .reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const totalValue = changeOrders
    .filter((c) => (c.status ?? "").toLowerCase() !== "cancelled")
    .reduce((s, c) => s + Number(c.amount ?? 0), 0);

  const projectsMap: Record<string, ProjectRef> = {};
  projects.forEach((p) => {
    projectsMap[p.id] = p;
  });

  const exposureTitles: Record<string, string> = {};
  exposures.forEach((e) => {
    exposureTitles[e.id] = e.title ?? e.id.slice(0, 8);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {editingChangeOrder && (
        <EditChangeOrderModal
          changeOrder={{
            id: editingChangeOrder.id,
            project_id: editingChangeOrder.project_id,
            financial_exposure_id: editingChangeOrder.financial_exposure_id,
            co_number: editingChangeOrder.co_number,
            title: editingChangeOrder.title,
            amount: editingChangeOrder.amount,
          }}
          exposures={exposures}
          exposureTitles={exposureTitles}
          saving={editSaving}
          error={editError}
          onSave={handleEditChangeOrder}
          onCancel={() => {
            setEditingChangeOrder(null);
            setEditError(null);
          }}
        />
      )}
      {showCreateModal && (
        <CreateChangeOrderModal
          projects={projects}
          exposures={exposures}
          selectedProjectId={null}
          prefillFromExposure={null}
          saving={createSaving}
          error={createError}
          onSave={handleCreateChangeOrder}
          onCancel={() => {
            setShowCreateModal(false);
            setCreateError(null);
          }}
        />
      )}
      {toast && (
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
          {toast}
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
            Change Orders
          </h1>
          <p className="pi-page-desc">
            Track submitted and approved change orders, connect them to exposures,
            and monitor billing status.
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
      ) : (
        <>
          {/* KPI cards */}
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
                borderLeft:
                  openCount > 0 ? "3px solid var(--warn)" : "3px solid var(--border)",
              }}
            >
              <div className="pi-stat-label">Open Change Orders</div>
              <div
                className="pi-stat-value"
                style={{
                  fontSize: 22,
                  color: openCount > 0 ? "var(--warn)" : "var(--text)",
                }}
              >
                {openCount}
              </div>
            </div>
            <div
              className="pi-stat"
              style={{
                minWidth: 0,
                borderLeft: "3px solid var(--border)",
              }}
            >
              <div className="pi-stat-label">Pending Approval Value</div>
              <div
                className="pi-stat-value"
                style={{ fontSize: 18, color: "var(--text)" }}
              >
                {formatCurrency(pendingApprovalValue)}
              </div>
            </div>
            <div
              className="pi-stat"
              style={{
                minWidth: 0,
                borderLeft: "3px solid var(--border)",
              }}
            >
              <div className="pi-stat-label">Approved Not Billed</div>
              <div
                className="pi-stat-value"
                style={{ fontSize: 18, color: "var(--text)" }}
              >
                {formatCurrency(approvedNotBilledValue)}
              </div>
            </div>
            <div
              className="pi-stat"
              style={{
                minWidth: 0,
                borderLeft:
                  totalValue > 0 ? "3px solid var(--brand)" : "3px solid var(--border)",
              }}
            >
              <div className="pi-stat-label">Total Change Order Value</div>
              <div
                className="pi-stat-value"
                style={{
                  fontSize: 18,
                  color: totalValue > 0 ? "var(--brand)" : "var(--text)",
                }}
              >
                {formatCurrency(totalValue)}
              </div>
            </div>
          </section>

          {/* Change Orders table */}
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
              All Change Orders
              <button
                onClick={() => {
                  setCreateError(null);
                  setShowCreateModal(true);
                }}
                className="pi-btn"
                style={{ padding: "8px 14px", fontSize: 13 }}
              >
                Create Change Order
              </button>
            </h2>
            {changeOrders.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                No change orders yet. Create one to get started.
              </p>
            ) : (
              <div className="pi-table-wrap">
                <table className="pi-table pi-table-dashboard">
                  <thead>
                    <tr>
                      <th>CO Number</th>
                      <th>Project</th>
                      <th>Title</th>
                      <th>Source Exposure</th>
                      <th style={{ width: 100 }}>Status</th>
                      <th style={{ textAlign: "right", width: 100 }}>Amount</th>
                      <th style={{ width: 100 }}>Created</th>
                      <th style={{ width: 100 }}>Updated</th>
                      <th style={{ width: 70 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {changeOrders.map((co) => {
                      const proj = co.projects ?? projectsMap[co.project_id];
                      return (
                        <tr key={co.id}>
                          <td
                            style={{
                              fontWeight: 600,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {co.co_number}
                          </td>
                          <td>
                            <Link
                              href={`/projects/${co.project_id}`}
                              style={{
                                fontWeight: 600,
                                color: "var(--text)",
                                textDecoration: "none",
                              }}
                            >
                              {proj?.project_number ?? co.project_id.slice(0, 8)}
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
                          <td>{co.title}</td>
                          <td>
                            {co.financial_exposure_id ? (
                              <Link
                                href="/exposures"
                                style={{
                                  fontSize: 13,
                                  color: "var(--brand)",
                                  textDecoration: "none",
                                }}
                              >
                                {exposureTitles[co.financial_exposure_id] ??
                                  co.financial_exposure_id.slice(0, 8)}
                              </Link>
                            ) : (
                              <span style={{ color: "var(--muted)" }}>—</span>
                            )}
                          </td>
                          <td>
                            <select
                              value={
                                CO_STATUSES.includes(
                                  (co.status ?? "").toLowerCase() as (typeof CO_STATUSES)[number],
                                )
                                  ? (co.status ?? "").toLowerCase()
                                  : "draft"
                              }
                              onChange={(ev) => {
                                const v = ev.target.value;
                                if (v && CO_STATUSES.includes(v as (typeof CO_STATUSES)[number]))
                                  updateChangeOrderStatus(co.id, v);
                              }}
                              disabled={statusUpdatingId === co.id}
                              className={statusBadgeClass(co.status)}
                              style={{
                                padding: "4px 8px",
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                textTransform: "capitalize",
                                border: "1px solid rgba(0,0,0,0.15)",
                                borderRadius: 4,
                                cursor:
                                  statusUpdatingId === co.id ? "not-allowed" : "pointer",
                                minWidth: 90,
                              }}
                            >
                              {CO_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {formatCurrency(co.amount)}
                          </td>
                          <td style={{ fontSize: 13, color: "var(--muted)" }}>
                            {formatDate(co.created_at)}
                          </td>
                          <td style={{ fontSize: 13, color: "var(--muted)" }}>
                            {formatDate(co.updated_at)}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => {
                                setEditError(null);
                                setEditingChangeOrder(co);
                              }}
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
                          </td>
                        </tr>
                      );
                    })}
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
