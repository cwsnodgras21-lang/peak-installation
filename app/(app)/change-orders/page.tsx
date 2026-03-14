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
  const [openStatusId, setOpenStatusId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

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
    setProjects((projRes.data ?? []) as unknown as ProjectRef[]);
    setExposures((expRes.data ?? []) as unknown as ExposureRef[]);
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
      {openStatusId && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 49 }}
            onClick={() => setOpenStatusId(null)}
          />
          <div
            className="pi-status-menu"
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 50 }}
          >
            {CO_STATUSES.map((s) => {
              const bc =
                s === "approved" || s === "billed"
                  ? "pi-badge pi-badge-good"
                  : s === "cancelled"
                  ? "pi-badge pi-badge-bad"
                  : "pi-badge pi-badge-warn";
              return (
                <div
                  key={s}
                  className="pi-status-option"
                  onClick={() => {
                    setOpenStatusId(null);
                    updateChangeOrderStatus(openStatusId, s);
                  }}
                >
                  <span className={bc}>{s.charAt(0).toUpperCase() + s.slice(1)}</span>
                </div>
              );
            })}
          </div>
        </>
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
            background: "rgba(15,15,20,0.85)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "10px 18px",
            fontSize: 13,
            color: "var(--text)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            animation: "slideUp 0.2s ease",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="6.5" fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth="1.2" />
            <path d="M5 8l2.5 2.5 3.5-4" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              border: "1px solid var(--border)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            ?
          </span>
          Help
        </Link>
      </header>

      {error && (
        <p style={{ color: "var(--bad)", padding: "12px 0" }}>{error}</p>
      )}

      {loading ? (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 16,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="pi-stat" style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 12,
                  }}
                >
                  <div className="pi-skeleton" style={{ height: 11, width: "55%", borderRadius: 4 }} />
                  <div className="pi-skeleton" style={{ height: 14, width: 14, borderRadius: 3 }} />
                </div>
                <div className="pi-skeleton" style={{ height: 22, width: "65%", borderRadius: 4 }} />
              </div>
            ))}
          </section>
          <section className="pi-card-lift" style={{ overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div className="pi-skeleton" style={{ height: 13, width: 150, borderRadius: 4 }} />
              <div className="pi-skeleton" style={{ height: 32, width: 150, borderRadius: 12 }} />
            </div>
            <div className="pi-table-wrap">
              <table className="pi-table">
                <thead>
                  <tr>
                    {["CO #", "Project", "Title", "Exposure", "Status", "Amount", "Created", "Updated", ""].map(
                      (h, i) => (
                        <th key={i}>
                          {h && (
                            <div
                              className="pi-skeleton"
                              style={{ height: 11, width: Math.max(28, h.length * 7), borderRadius: 3 }}
                            />
                          )}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <tr key={i}>
                      <td><div className="pi-skeleton" style={{ height: 13, width: 55, borderRadius: 3 }} /></td>
                      <td><div className="pi-skeleton" style={{ height: 13, width: 80, borderRadius: 3 }} /></td>
                      <td><div className="pi-skeleton" style={{ height: 13, width: 160, borderRadius: 3 }} /></td>
                      <td><div className="pi-skeleton" style={{ height: 13, width: 110, borderRadius: 3 }} /></td>
                      <td><div className="pi-skeleton" style={{ height: 20, width: 80, borderRadius: 4 }} /></td>
                      <td style={{ textAlign: "right" }}>
                        <div className="pi-skeleton" style={{ height: 13, width: 60, borderRadius: 3, marginLeft: "auto" }} />
                      </td>
                      <td><div className="pi-skeleton" style={{ height: 13, width: 65, borderRadius: 3 }} /></td>
                      <td><div className="pi-skeleton" style={{ height: 13, width: 65, borderRadius: 3 }} /></td>
                      <td><div className="pi-skeleton" style={{ height: 26, width: 28, borderRadius: 6 }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
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
                borderLeft: openCount > 0 ? "3px solid var(--warn)" : "3px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                <div className="pi-stat-label" style={{ marginBottom: 0 }}>Open Change Orders</div>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ color: "var(--muted)", opacity: 0.45, flexShrink: 0 }}>
                  <rect x="2" y="1.5" width="9" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="4.5" y1="5" x2="8.5" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="4.5" y1="7.5" x2="8.5" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="4.5" y1="10" x2="7" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="pi-stat-value" style={{ fontSize: 22, color: openCount > 0 ? "var(--warn)" : "var(--text)" }}>
                {openCount}
              </div>
            </div>
            <div
              className="pi-stat"
              style={{ minWidth: 0, borderLeft: "3px solid var(--border)" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                <div className="pi-stat-label" style={{ marginBottom: 0 }}>Pending Approval Value</div>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ color: "var(--muted)", opacity: 0.45, flexShrink: 0 }}>
                  <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M7.5 4.5V7.5l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="pi-stat-value" style={{ fontSize: 18, color: "var(--text)" }}>
                {formatCurrency(pendingApprovalValue)}
              </div>
            </div>
            <div
              className="pi-stat"
              style={{ minWidth: 0, borderLeft: "3px solid var(--border)" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                <div className="pi-stat-label" style={{ marginBottom: 0 }}>Approved Not Billed</div>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ color: "var(--muted)", opacity: 0.45, flexShrink: 0 }}>
                  <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5 7.5l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="pi-stat-value" style={{ fontSize: 18, color: "var(--text)" }}>
                {formatCurrency(approvedNotBilledValue)}
              </div>
            </div>
            <div
              className="pi-stat"
              style={{
                minWidth: 0,
                borderLeft: totalValue > 0 ? "3px solid var(--brand)" : "3px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                <div className="pi-stat-label" style={{ marginBottom: 0 }}>Total Change Order Value</div>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ color: "var(--muted)", opacity: 0.45, flexShrink: 0 }}>
                  <path d="M2 10.5l3.5-3.5 3 3L13 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 3h3v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <div className="pi-stat-value" style={{ fontSize: 18, color: totalValue > 0 ? "var(--brand)" : "var(--text)" }}>
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
                            <div
                              role="button"
                              className={statusBadgeClass(co.status)}
                              onClick={(e) => {
                                if (statusUpdatingId === co.id) return;
                                const rect = e.currentTarget.getBoundingClientRect();
                                setMenuPos({ top: rect.bottom + 4, left: rect.left });
                                setOpenStatusId(openStatusId === co.id ? null : co.id);
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "4px 8px",
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                textTransform: "capitalize",
                                borderRadius: 4,
                                cursor: statusUpdatingId === co.id ? "not-allowed" : "pointer",
                                minWidth: 90,
                                userSelect: "none",
                                opacity: statusUpdatingId === co.id ? 0.6 : 1,
                              }}
                            >
                              {(co.status ?? "draft").charAt(0).toUpperCase() + (co.status ?? "draft").slice(1)}
                              <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ flexShrink: 0 }}>
                                <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
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
                              className="pi-icon-btn"
                              onClick={() => {
                                setEditError(null);
                                setEditingChangeOrder(co);
                              }}
                              title="Edit change order"
                              aria-label="Edit change order"
                            >
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M9.5 2.5l2 2-6.5 6.5-2.5.5.5-2.5 6.5-6.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                              </svg>
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
