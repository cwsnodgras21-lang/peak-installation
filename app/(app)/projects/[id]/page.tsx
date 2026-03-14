"use client";

import Link from "next/link";
import { use, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { EditExposureModal } from "../../components/EditExposureModal";
import { CreateChangeOrderModal } from "../../components/CreateChangeOrderModal";

// ─── Route props ──────────────────────────────────────────────────────────────
type ProjectDetailPageProps = {
  params: Promise<{ id: string }>;
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Project = {
  id: string;
  tenant_id: string;
  project_number: string;
  name: string;
  client_name: string | null;
  status: string;
  location: string | null;
  created_at: string | null;
};

type ScheduleVersion = {
  id: string;
  project_id: string;
  version_number: number;
  is_current: boolean;
  created_at: string | null;
};

type LaborWeek = {
  id: string;
  schedule_version_id: string;
  week_start_date: string;
  labor_role_id: string | null;
  headcount: number | null;
  hours_st: number | null;
  hours_ot: number | null;
};

type LaborRole = {
  id: string;
  name: string;
};

type FinancialExposure = {
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

type CapacityRow = {
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

type ContributingDemandRow = {
  project_number: string;
  project_name: string;
  version_number: number;
  labor_role: string;
  demand_headcount: number;
  demand_hours: number;
};

// Grouped project demand row (derived, not from DB)
type DemandRow = {
  week_start_date: string;
  labor_role: string;
  headcount: number;
  total_hours: number;
};

// ─── Labor row form state ─────────────────────────────────────────────────────
type LaborRowDraft = {
  id: string | null;
  week_start_date: string;
  labor_role_id: string;
  headcount: string;
  hours_st: string;
  hours_ot: string;
};

const EMPTY_DRAFT: LaborRowDraft = {
  id: null,
  week_start_date: "",
  labor_role_id: "",
  headcount: "",
  hours_st: "",
  hours_ot: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function snapToMonday(dateStr: string): string {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function sumWeekRows(rows: LaborWeek[]) {
  return rows.reduce(
    (acc, row) => {
      acc.headcount += Number(row.headcount ?? 0);
      acc.hours_st += Number(row.hours_st ?? 0);
      acc.hours_ot += Number(row.hours_ot ?? 0);
      return acc;
    },
    { headcount: 0, hours_st: 0, hours_ot: 0 },
  );
}

function validateLaborDraft(draft: LaborRowDraft): string | null {
  if (!draft.labor_role_id) return "Labor role is required.";
  const hc = Number(draft.headcount);
  const st = Number(draft.hours_st);
  const ot = Number(draft.hours_ot);
  if (isNaN(hc) || hc < 0) return "Headcount must be 0 or greater.";
  if (isNaN(st) || st < 0) return "ST hours must be 0 or greater.";
  if (isNaN(ot) || ot < 0) return "OT hours must be 0 or greater.";
  return null;
}

function numOrNull(val: string): number | null {
  if (val === "" || val == null) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

/** Build grouped project demand rows from labor weeks + role lookup. */
function buildDemandRows(
  laborWeeks: LaborWeek[],
  roleNameById: Record<string, string>,
): DemandRow[] {
  const map: Record<string, DemandRow> = {};
  for (const w of laborWeeks) {
    const roleName = w.labor_role_id
      ? (roleNameById[w.labor_role_id] ?? "Unknown Role")
      : "No Role";
    const key = `${w.week_start_date}|||${roleName}`;
    if (!map[key]) {
      map[key] = {
        week_start_date: w.week_start_date,
        labor_role: roleName,
        headcount: 0,
        total_hours: 0,
      };
    }
    map[key].headcount += Number(w.headcount ?? 0);
    map[key].total_hours += Number(w.hours_st ?? 0) + Number(w.hours_ot ?? 0);
  }
  return Object.values(map).sort((a, b) => {
    const d = a.week_start_date.localeCompare(b.week_start_date);
    return d !== 0 ? d : a.labor_role.localeCompare(b.labor_role);
  });
}

/** Defensive status → color mapping for capacity rows. */
function capacityStatusColors(status: string | null): {
  text: string;
  bg: string;
  border: string;
} {
  const s = (status ?? "").toLowerCase();
  // Positive / healthy
  if (/\b(ok|healthy|available|positive|good|surplus)\b/.test(s)) {
    return {
      text: "#4ade80",
      bg: "rgba(74,222,128,0.07)",
      border: "rgba(74,222,128,0.2)",
    };
  }
  // Tight / warning
  if (/\b(tight|warning|low|near|limited)\b/.test(s)) {
    return {
      text: "#facc15",
      bg: "rgba(250,204,21,0.07)",
      border: "rgba(250,204,21,0.2)",
    };
  }
  // Short / deficit
  if (
    /\b(short|shortage|negative|deficit|over|critical|insufficient)\b/.test(s)
  ) {
    return {
      text: "#f87171",
      bg: "rgba(248,113,113,0.07)",
      border: "rgba(248,113,113,0.2)",
    };
  }
  // Neutral fallback
  return {
    text: "#94a3b8",
    bg: "rgba(255,255,255,0.025)",
    border: "rgba(255,255,255,0.07)",
  };
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  orange: "#fb923c",
  orangeDim: "#ea580c",
  green: "#4ade80",
  yellow: "#facc15",
  red: "#f87171",
  primary: "#f1f5f9",
  muted: "#94a3b8",
  dim: "#64748b",
  faint: "#475569",
  border: "rgba(255,255,255,0.08)",
  borderFaint: "rgba(255,255,255,0.06)",
  surface: "rgba(255,255,255,0.025)",
  surfaceLift: "rgba(255,255,255,0.04)",
};

const STATUS_MAP: Record<string, { bg: string; text: string; border: string }> =
  {
    active: {
      bg: "rgba(251,146,60,0.12)",
      text: C.orange,
      border: "rgba(251,146,60,0.35)",
    },
    complete: {
      bg: "rgba(74,222,128,0.10)",
      text: C.green,
      border: "rgba(74,222,128,0.3)",
    },
    on_hold: {
      bg: "rgba(250,204,21,0.10)",
      text: C.yellow,
      border: "rgba(250,204,21,0.3)",
    },
    cancelled: {
      bg: "rgba(248,113,113,0.10)",
      text: C.red,
      border: "rgba(248,113,113,0.3)",
    },
    open: {
      bg: "rgba(251,146,60,0.12)",
      text: C.orange,
      border: "rgba(251,146,60,0.35)",
    },
    closed: {
      bg: "rgba(74,222,128,0.10)",
      text: C.green,
      border: "rgba(74,222,128,0.3)",
    },
    pending: {
      bg: "rgba(250,204,21,0.10)",
      text: C.yellow,
      border: "rgba(250,204,21,0.3)",
    },
  };

function coStatusBadgeClass(status: string | null): string {
  if (!status) return "pi-badge";
  const s = status.toLowerCase();
  if (s === "approved" || s === "billed") return "pi-badge pi-badge-good";
  if (s === "submitted" || s === "draft") return "pi-badge pi-badge-warn";
  if (s === "cancelled") return "pi-badge pi-badge-bad";
  return "pi-badge";
}

// ─── Shared UI components ─────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().replace(/[\s-]+/g, "_");
  const c = STATUS_MAP[key] ?? {
    bg: "rgba(148,163,184,0.10)",
    text: C.muted,
    border: "rgba(148,163,184,0.3)",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    >
      {status}
    </span>
  );
}

function Panel({
  title,
  accent = false,
  action,
  children,
}: {
  title: string;
  accent?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="pi-card-lift"
      style={{
        overflow: "hidden",
        padding: 0,
      }}
    >
      <div
        style={{
          padding: "14px 20px",
          background: accent
            ? "linear-gradient(90deg, rgba(251,146,60,0.1) 0%, rgba(251,146,60,0.02) 100%)"
            : "var(--panel-lift)",
          borderBottom: "1px solid var(--border-faint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {accent && (
            <span
              style={{
                width: 4,
                height: 18,
                borderRadius: 2,
                flexShrink: 0,
                background: "var(--brand)",
              }}
            />
          )}
          <h2
            className="pi-section-title"
            style={{
              margin: 0,
              fontSize: 13,
              letterSpacing: "0.06em",
              color: accent ? "var(--brand)" : "var(--muted)",
            }}
          >
            {title}
          </h2>
        </div>
        {action && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {action}
          </div>
        )}
      </div>
      <div style={{ padding: "16px 20px 20px" }}>{children}</div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div
      className="pi-section-title"
      style={{
        paddingTop: 16,
        paddingBottom: 8,
        marginBottom: 8,
        borderBottom: "1px solid var(--border-faint)",
      }}
    >
      {label}
    </div>
  );
}

function ColHead({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "var(--muted)",
      }}
    >
      {label}
    </span>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--border-faint)",
        alignItems: "start",
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--muted)",
          paddingTop: 1,
        }}
      >
        {label}
      </span>
      <span style={{ color: "var(--text)", fontSize: 14, lineHeight: 1.5 }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="pi-stat"
      style={{
        minWidth: 0,
        borderLeft: "3px solid var(--border)",
      }}
    >
      <div className="pi-stat-label">{label}</div>
      <div className="pi-stat-value" style={{ fontSize: 22 }}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p
      style={{
        margin: "16px 0 0",
        fontSize: 13,
        color: "var(--muted)",
      }}
    >
      {label}
    </p>
  );
}

function LoadingSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: 40,
        color: C.dim,
        fontSize: 13,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 15,
          height: 15,
          border: `2px solid ${C.orange}`,
          borderTopColor: "transparent",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
          flexShrink: 0,
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {label}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "12px 16px",
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.25)",
        borderRadius: "var(--r-sm)",
        color: "var(--bad)",
        fontSize: 13,
      }}
    >
      {message}
    </div>
  );
}

function Btn({
  onClick,
  disabled = false,
  variant = "default",
  children,
  small = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger" | "ghost";
  children: React.ReactNode;
  small?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: {
      background: "var(--panel-lift)",
      color: "var(--text)",
      border: "1px solid var(--border)",
    },
    primary: { background: "var(--brand)", color: "#fff", border: "none" },
    danger: {
      background: "rgba(239,68,68,0.12)",
      color: "var(--bad)",
      border: "1px solid rgba(239,68,68,0.35)",
    },
    ghost: {
      background: "transparent",
      color: "var(--muted)",
      border: "1px solid var(--border)",
    },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? "6px 12px" : "8px 16px",
        borderRadius: "var(--r-sm)",
        fontFamily: "inherit",
        fontSize: small ? 12 : 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

// ─── Revision reason (for Create New Version) ──────────────────────────────────
type RevisionReason =
  | "internal"
  | "client_driven"
  | "scope_change"
  | "other";

const REVISION_OPTIONS: { value: RevisionReason; label: string; createsExposure?: boolean }[] = [
  { value: "internal", label: "Internal planning adjustment" },
  { value: "client_driven", label: "Client-driven schedule change", createsExposure: true },
  { value: "scope_change", label: "Scope change", createsExposure: true },
  { value: "other", label: "Other" },
];

// ─── Create version modal ─────────────────────────────────────────────────────
function CreateVersionModal({
  currentVersionNum,
  creating,
  createError,
  revisionReason,
  onRevisionReasonChange,
  onConfirm,
  onCancel,
}: {
  currentVersionNum: number;
  creating: boolean;
  createError: string | null;
  revisionReason: RevisionReason;
  onRevisionReasonChange: (v: RevisionReason) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#0f172a",
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 28,
          width: "100%",
          maxWidth: 440,
          display: "grid",
          gap: 20,
        }}
      >
        <h3
          style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.primary }}
        >
          Create New Schedule Version
        </h3>
        <div style={{ display: "grid", gap: 14 }}>
          <p
            style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.6 }}
          >
            Creates{" "}
            <strong style={{ color: C.primary }}>
              v{currentVersionNum + 1}
            </strong>{" "}
            and copies all labor rows from{" "}
            <strong style={{ color: C.primary }}>v{currentVersionNum}</strong>.
            The previous version becomes read-only.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.muted,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Revision Reason
            </span>
            {REVISION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  fontSize: 13,
                  color: C.muted,
                  cursor: "pointer",
                  padding: "12px 14px",
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                }}
              >
                <input
                  type="radio"
                  name="revisionReason"
                  checked={revisionReason === opt.value}
                  onChange={() => onRevisionReasonChange(opt.value)}
                  style={{
                    width: 15,
                    height: 15,
                    accentColor: C.orange,
                    cursor: "pointer",
                    marginTop: 1,
                  }}
                />
                <span>
                  {opt.label}
                  {opt.createsExposure && (
                    <span
                      style={{
                        display: "block",
                        fontSize: 11,
                        color: C.faint,
                        marginTop: 2,
                      }}
                    >
                      Creates an open financial exposure linked to v
                      {currentVersionNum + 1}.
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
          {createError && <ErrorBanner message={createError} />}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn onClick={onCancel} disabled={creating} variant="ghost">
            Cancel
          </Btn>
          <Btn onClick={onConfirm} disabled={creating} variant="primary">
            {creating ? "Creating..." : "Create Version"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Labor row editor form ────────────────────────────────────────────────────
function LaborRowForm({
  draft,
  laborRoles,
  saving,
  onDraftChange,
  onSave,
  onCancel,
  weekStartReadOnly = false,
  validationError,
}: {
  draft: LaborRowDraft;
  laborRoles: LaborRole[];
  saving: boolean;
  onDraftChange: (d: LaborRowDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  weekStartReadOnly?: boolean;
  validationError?: string | null;
}) {
  const inputStyle: React.CSSProperties = {
    background: "#0f172a",
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.primary,
    fontSize: 12,
    padding: "5px 8px",
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
  };
  const canSave = !saving && !validationError;
  return (
    <div
      style={{
        background: "rgba(251,146,60,0.04)",
        border: `1px solid rgba(251,146,60,0.18)`,
        borderRadius: 6,
        padding: "12px 14px",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 10,
        }}
      >
        {(
          [
            [
              "week_start_date",
              "Week Start",
              weekStartReadOnly ? (
                <span
                  key="wsd"
                  style={{
                    ...inputStyle,
                    background: "transparent",
                    border: "none",
                    padding: "5px 0",
                  }}
                >
                  {draft.week_start_date
                    ? formatWeekLabel(draft.week_start_date)
                    : "—"}
                </span>
              ) : (
                <input
                  key="wsd"
                  type="date"
                  value={draft.week_start_date}
                  onChange={(e) =>
                    onDraftChange({ ...draft, week_start_date: e.target.value })
                  }
                  style={inputStyle}
                />
              ),
            ],
            [
              "labor_role_id",
              "Role",
              <select
                key="role"
                value={draft.labor_role_id}
                onChange={(e) =>
                  onDraftChange({ ...draft, labor_role_id: e.target.value })
                }
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">— Select role —</option>
                {laborRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>,
            ],
            [
              "headcount",
              "Headcount",
              <input
                key="hc"
                type="number"
                min={0}
                value={draft.headcount}
                onChange={(e) =>
                  onDraftChange({ ...draft, headcount: e.target.value })
                }
                style={inputStyle}
              />,
            ],
            [
              "hours_st",
              "ST Hours",
              <input
                key="st"
                type="number"
                min={0}
                value={draft.hours_st}
                onChange={(e) =>
                  onDraftChange({ ...draft, hours_st: e.target.value })
                }
                style={inputStyle}
              />,
            ],
            [
              "hours_ot",
              "OT Hours",
              <input
                key="ot"
                type="number"
                min={0}
                value={draft.hours_ot}
                onChange={(e) =>
                  onDraftChange({ ...draft, hours_ot: e.target.value })
                }
                style={inputStyle}
              />,
            ],
          ] as [string, string, React.ReactNode][]
        ).map(([key, label, el]) => (
          <div key={key} style={{ display: "grid", gap: 3 }}>
            <label
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                color: C.faint,
              }}
            >
              {label}
            </label>
            {el}
          </div>
        ))}
      </div>
      {validationError && (
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 6,
            color: "var(--bad)",
            fontSize: 12,
          }}
        >
          {validationError}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={onSave} disabled={!canSave} variant="primary" small>
          {saving ? "Saving..." : "Save"}
        </Btn>
        <Btn onClick={onCancel} disabled={saving} variant="ghost" small>
          Cancel
        </Btn>
      </div>
    </div>
  );
}

// ─── Edit labor row modal ─────────────────────────────────────────────────────
function EditLaborRowModal({
  draft,
  laborRoles,
  saving,
  laborError,
  onDraftChange,
  onSave,
  onCancel,
}: {
  draft: LaborRowDraft;
  laborRoles: LaborRole[];
  saving: boolean;
  laborError: string | null;
  onDraftChange: (d: LaborRowDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const validationError = validateLaborDraft(draft);
  const displayError = laborError ?? validationError;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#0f172a",
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 28,
          width: "100%",
          maxWidth: 440,
          display: "grid",
          gap: 20,
        }}
      >
        <h3
          style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.primary }}
        >
          Edit Labor Row
        </h3>
        <LaborRowForm
          draft={draft}
          laborRoles={laborRoles}
          saving={saving}
          onDraftChange={onDraftChange}
          onSave={onSave}
          onCancel={onCancel}
          weekStartReadOnly
          validationError={displayError}
        />
      </div>
    </div>
  );
}

// ─── Confirm delete labor row modal ──────────────────────────────────────────
function ConfirmDeleteLaborRowModal({
  roleLabel,
  weekLabel,
  deleting,
  onConfirm,
  onCancel,
}: {
  roleLabel: string;
  weekLabel: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#0f172a",
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 28,
          width: "100%",
          maxWidth: 400,
          display: "grid",
          gap: 20,
        }}
      >
        <h3
          style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.primary }}
        >
          Delete Labor Row
        </h3>
        <p
          style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.6 }}
        >
          Delete this labor row? <strong>{roleLabel}</strong> — Week of{" "}
          {weekLabel}. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn onClick={onCancel} disabled={deleting} variant="ghost">
            Cancel
          </Btn>
          <Btn
            onClick={onConfirm}
            disabled={deleting}
            variant="danger"
          >
            {deleting ? "Deleting..." : "Delete"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Create exposure modal ───────────────────────────────────────────────────
const CAUSE_TYPE_OPTIONS = [
  { value: "client_driven", label: "Client-driven" },
  { value: "scope_change", label: "Scope change" },
  { value: "internal_risk", label: "Internal risk" },
  { value: "other", label: "Other" },
] as const;

function CreateExposureModal({
  currentVersionId,
  saving,
  error,
  onSave,
  onCancel,
}: {
  currentVersionId: string | null;
  saving: boolean;
  error: string | null;
  onSave: (draft: {
    title: string;
    cause_type: string;
    status: string;
    attachToVersion: boolean;
    laborHoursDelta: string;
    laborCostDelta: string;
    materialCostDelta: string;
  }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [causeType, setCauseType] = useState("");
  const [attachToVersion, setAttachToVersion] = useState(false);
  const [laborHoursDelta, setLaborHoursDelta] = useState("0");
  const [laborCostDelta, setLaborCostDelta] = useState("0");
  const [materialCostDelta, setMaterialCostDelta] = useState("0");

  function validate(): string | null {
    if (!title.trim()) return "Title / Reason is required.";
    if (!causeType) return "Cause type is required.";
    const lh = Number(laborHoursDelta);
    const lc = Number(laborCostDelta);
    const mc = Number(materialCostDelta);
    if (isNaN(lh) || lh < 0) return "Labor hours delta must be 0 or greater.";
    if (isNaN(lc) || lc < 0) return "Labor cost delta must be 0 or greater.";
    if (isNaN(mc) || mc < 0) return "Material cost delta must be 0 or greater.";
    return null;
  }

  const validationError = validate();
  const canSave = !saving && !validationError;

  const inputStyle: React.CSSProperties = {
    background: "#0f172a",
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.primary,
    fontSize: 12,
    padding: "6px 10px",
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#0f172a",
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 28,
          width: "100%",
          maxWidth: 440,
          maxHeight: "90vh",
          overflowY: "auto",
          display: "grid",
          gap: 20,
        }}
      >
        <h3
          style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.primary }}
        >
          Create Exposure
        </h3>
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: C.faint,
              }}
            >
              Title / Reason
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Client requested additional scope"
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: C.faint,
              }}
            >
              Cause Type
            </label>
            <select
              value={causeType}
              onChange={(e) => setCauseType(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="">— Select —</option>
              {CAUSE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {currentVersionId && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                color: C.muted,
                cursor: "pointer",
                padding: "10px 12px",
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
              }}
            >
              <input
                type="checkbox"
                checked={attachToVersion}
                onChange={(e) => setAttachToVersion(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: C.orange }}
              />
              Attach to current schedule version
            </label>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: C.faint,
                }}
              >
                Labor Hrs Δ
              </label>
              <input
                type="number"
                min={0}
                value={laborHoursDelta}
                onChange={(e) => setLaborHoursDelta(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: C.faint,
                }}
              >
                Labor Cost Δ
              </label>
              <input
                type="number"
                min={0}
                value={laborCostDelta}
                onChange={(e) => setLaborCostDelta(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: C.faint,
                }}
              >
                Material Cost Δ
              </label>
              <input
                type="number"
                min={0}
                value={materialCostDelta}
                onChange={(e) => setMaterialCostDelta(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
          {(validationError || error) && (
            <div
              style={{
                padding: "8px 12px",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 6,
                color: "var(--bad)",
                fontSize: 12,
              }}
            >
              {validationError ?? error}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn onClick={onCancel} disabled={saving} variant="ghost">
            Cancel
          </Btn>
          <Btn
            onClick={() =>
              onSave({
                title: title.trim(),
                cause_type: causeType,
                status: "open",
                attachToVersion,
                laborHoursDelta,
                laborCostDelta,
                materialCostDelta,
              })
            }
            disabled={!canSave}
            variant="primary"
          >
            {saving ? "Creating..." : "Create Exposure"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const hasAppliedUrlParams = useRef(false);

  // ── Data state ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [scheduleVersions, setScheduleVersions] = useState<ScheduleVersion[]>(
    [],
  );
  const [laborWeeks, setLaborWeeks] = useState<LaborWeek[]>([]);
  const [laborRoles, setLaborRoles] = useState<LaborRole[]>([]);
  const [exposures, setExposures] = useState<FinancialExposure[]>([]);
  const [capacityRows, setCapacityRows] = useState<CapacityRow[]>([]);

  // ── Version switcher ───────────────────────────────────────────────────────
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);
  const [switchedLaborWeeks, setSwitchedLaborWeeks] = useState<LaborWeek[]>([]);
  const [switchLoading, setSwitchLoading] = useState(false);

  // ── Create version modal ───────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [revisionReason, setRevisionReason] = useState<RevisionReason>("internal");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Confirmation toast ─────────────────────────────────────────────────────
  const [confirmationToast, setConfirmationToast] = useState<string | null>(null);
  const [laborRowToast, setLaborRowToast] = useState<string | null>(null);

  // ── Labor row editing ──────────────────────────────────────────────────────
  const [editingDraft, setEditingDraft] = useState<LaborRowDraft | null>(null);
  const [addingDraft, setAddingDraft] = useState<LaborRowDraft | null>(null);
  const [savingRow, setSavingRow] = useState(false);
  const [laborError, setLaborError] = useState<string | null>(null);
  const [deleteRowTarget, setDeleteRowTarget] = useState<{
    rowId: string;
    versionId: string;
    roleLabel: string;
    weekLabel: string;
  } | null>(null);
  const [deletingRow, setDeletingRow] = useState(false);

  // ── Exposure status update ──────────────────────────────────────────────────
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  // ── Edit exposure modal ───────────────────────────────────────────────────
  const [editingExposure, setEditingExposure] = useState<FinancialExposure | null>(
    null,
  );
  const [editingExposureSaving, setEditingExposureSaving] = useState(false);
  const [editingExposureError, setEditingExposureError] = useState<string | null>(
    null,
  );

  // ── Create exposure modal ──────────────────────────────────────────────────
  const [showCreateExposureModal, setShowCreateExposureModal] = useState(false);
  const [createExposureSaving, setCreateExposureSaving] = useState(false);
  const [createExposureError, setCreateExposureError] = useState<string | null>(
    null,
  );

  // ── Create CO from exposure ───────────────────────────────────────────────
  const [createCOFromExposure, setCreateCOFromExposure] =
    useState<FinancialExposure | null>(null);
  const [createCOSaving, setCreateCOSaving] = useState(false);
  const [createCOError, setCreateCOError] = useState<string | null>(null);
  const [coByExposureId, setCoByExposureId] = useState<
    Record<string, { co_number: string; id: string; status: string }>
  >({});

  // ── Forecast drilldown ─────────────────────────────────────────────────────
  const [selectedForecastRow, setSelectedForecastRow] = useState<{
    week_start_date: string;
    labor_role: string;
  } | null>(null);
  const [contributingRows, setContributingRows] = useState<
    ContributingDemandRow[]
  >([]);
  const [contributingLoading, setContributingLoading] = useState(false);

  // ── Load all page data ─────────────────────────────────────────────────────
  async function loadAll() {
    setLoading(true);
    setError(null);

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select(
        "id, tenant_id, project_number, name, client_name, status, location, created_at",
      )
      .eq("id", id)
      .single();
    if (projectError) {
      setError(projectError.message);
      setLoading(false);
      return;
    }
    const proj = projectData as Project;
    setProject(proj);

    const { data: versionsData, error: versionsError } = await supabase
      .from("schedule_versions")
      .select("id, project_id, version_number, is_current, created_at")
      .eq("project_id", id)
      .order("version_number", { ascending: false });
    if (versionsError) {
      setError(versionsError.message);
      setLoading(false);
      return;
    }
    const versions = (versionsData as ScheduleVersion[]) ?? [];
    setScheduleVersions(versions);

    const currentVersion = versions.find((v) => v.is_current) ?? null;
    if (currentVersion) {
      const { data: laborData, error: laborErr } = await supabase
        .from("schedule_labor_weeks")
        .select(
          "id, schedule_version_id, week_start_date, labor_role_id, headcount, hours_st, hours_ot",
        )
        .eq("schedule_version_id", currentVersion.id)
        .order("week_start_date", { ascending: true });
      if (laborErr) {
        setError(laborErr.message);
        setLoading(false);
        return;
      }
      setLaborWeeks((laborData as LaborWeek[]) ?? []);
    } else {
      setLaborWeeks([]);
    }

    const { data: rolesData, error: rolesErr } = await supabase
      .from("labor_roles")
      .select("id, name")
      .order("name", { ascending: true });
    if (rolesErr) {
      setError(rolesErr.message);
      setLoading(false);
      return;
    }
    setLaborRoles((rolesData as LaborRole[]) ?? []);

    const { data: exposureData, error: exposureErr } = await supabase
      .from("financial_exposures")
      .select(
        "id, project_id, schedule_version_id, title, description, cause_type, " +
          "estimated_labor_hours_delta, estimated_labor_cost_delta, " +
          "estimated_material_cost_delta, status, created_at",
      )
      .eq("project_id", id)
      .order("created_at", { ascending: false });
    if (exposureErr) {
      setError(exposureErr.message);
      setLoading(false);
      return;
    }
    const expList = (exposureData ?? []) as unknown as FinancialExposure[];
    setExposures(expList);

    const expIds = expList.map((e) => e.id);
    if (expIds.length > 0) {
      const { data: coData } = await supabase
        .from("change_orders")
        .select("id, co_number, financial_exposure_id, status")
        .in("financial_exposure_id", expIds);
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
    } else {
      setCoByExposureId({});
    }

    // Capacity view — filtered by tenant_id
    const { data: capData, error: capErr } = await supabase
      .from("v_capacity_forecast_12w")
      .select(
        "tenant_id, week_start_date, labor_role, demand_hours, available_hours, net_hours, " +
          "demand_headcount, available_headcount, net_headcount, status",
      )
      .eq("tenant_id", proj.tenant_id)
      .order("week_start_date", { ascending: true })
      .order("labor_role", { ascending: true });
    if (!capErr) setCapacityRows((capData ?? []) as unknown as CapacityRow[]);

    setViewingVersionId(null);
    setSwitchedLaborWeeks([]);
    setLoading(false);
  }

  async function switchToVersion(versionId: string) {
    const cv = scheduleVersions.find((v) => v.is_current);
    if (versionId === (cv?.id ?? "")) {
      setViewingVersionId(null);
      setSwitchedLaborWeeks([]);
      return;
    }
    setSwitchLoading(true);
    const { data, error } = await supabase
      .from("schedule_labor_weeks")
      .select(
        "id, schedule_version_id, week_start_date, labor_role_id, headcount, hours_st, hours_ot",
      )
      .eq("schedule_version_id", versionId)
      .order("week_start_date", { ascending: true });
    if (error) {
      setError(error.message);
    } else {
      setViewingVersionId(versionId);
      setSwitchedLaborWeeks((data as LaborWeek[]) ?? []);
    }
    setSwitchLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply week/role from URL params (e.g. from dashboard capacity issue click-through)
  useEffect(() => {
    if (loading || capacityRows.length === 0 || hasAppliedUrlParams.current)
      return;
    const week = searchParams.get("week");
    const role = searchParams.get("role");
    if (!week || !role) return;
    const match = capacityRows.some(
      (r) => r.week_start_date === week && r.labor_role === role,
    );
    if (match) {
      hasAppliedUrlParams.current = true;
      setSelectedForecastRow({ week_start_date: week, labor_role: role });
      requestAnimationFrame(() => {
        document.getElementById("capacity-forecast")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [loading, capacityRows, searchParams]);

  useEffect(() => {
    if (selectedForecastRow && project) {
      loadContributingDemand(
        selectedForecastRow.week_start_date,
        selectedForecastRow.labor_role,
      );
    } else {
      setContributingRows([]);
    }
  }, [selectedForecastRow?.week_start_date, selectedForecastRow?.labor_role, project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateVersion() {
    if (!project) return;
    setCreating(true);
    setCreateError(null);
    const createsExposure =
      revisionReason === "client_driven" || revisionReason === "scope_change";
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: rpcError } = await supabase.rpc("create_schedule_version", {
      p_project_id: id,
      p_client_driven: createsExposure,
      p_user_id: user?.id ?? null,
    });
    if (rpcError) {
      setCreateError(rpcError.message);
      setCreating(false);
      return;
    }
    setShowModal(false);
    setRevisionReason("internal");

    // If client-driven or scope change, create financial exposure
    if (createsExposure) {
      const { data: newVersion } = await supabase
        .from("schedule_versions")
        .select("id, version_number")
        .eq("project_id", id)
        .eq("is_current", true)
        .single();
      if (newVersion) {
        const titleBase =
          revisionReason === "client_driven"
            ? "Client-driven schedule revision"
            : "Scope change revision";
        const title = `${titleBase} v${newVersion.version_number}`;
        const { error: expErr } = await supabase
          .from("financial_exposures")
          .insert({
            tenant_id: project.tenant_id,
            project_id: id,
            schedule_version_id: newVersion.id,
            title,
            status: "open",
            cause_type: revisionReason,
            estimated_labor_hours_delta: 0,
            estimated_labor_cost_delta: 0,
            estimated_material_cost_delta: 0,
          });
        if (!expErr) {
          setConfirmationToast(
            `Schedule version v${newVersion.version_number} created. Financial exposure record opened.`,
          );
          setTimeout(() => setConfirmationToast(null), 4000);
        }
      }
    } else {
      const { data: newVersion } = await supabase
        .from("schedule_versions")
        .select("version_number")
        .eq("project_id", id)
        .eq("is_current", true)
        .single();
      if (newVersion) {
        setConfirmationToast(
          `Schedule version v${newVersion.version_number} created.`,
        );
        setTimeout(() => setConfirmationToast(null), 4000);
      }
    }

    setCreating(false);
    await loadAll();
  }

  async function reloadAfterLaborMutation(versionId: string) {
    // Refresh labor weeks for the current version
    const { data: laborData, error: laborErr } = await supabase
      .from("schedule_labor_weeks")
      .select(
        "id, schedule_version_id, week_start_date, labor_role_id, headcount, hours_st, hours_ot",
      )
      .eq("schedule_version_id", versionId)
      .order("week_start_date", { ascending: true });
    if (!laborErr) setLaborWeeks((laborData as LaborWeek[]) ?? []);

    // Also refresh capacity rows so the forecast panel is not stale
    if (project) {
      const { data: capData, error: capErr } = await supabase
        .from("v_capacity_forecast_12w")
        .select(
          "tenant_id, week_start_date, labor_role, demand_hours, available_hours, net_hours, " +
            "demand_headcount, available_headcount, net_headcount, status",
        )
        .eq("tenant_id", project.tenant_id)
        .order("week_start_date", { ascending: true })
        .order("labor_role", { ascending: true });
      if (!capErr) setCapacityRows((capData ?? []) as unknown as CapacityRow[]);
    }
  }

  async function loadContributingDemand(
    weekStartDate: string,
    laborRoleName: string,
  ) {
    if (!project) return;
    setContributingLoading(true);
    setContributingRows([]);
    const { data: roleData } = await supabase
      .from("labor_roles")
      .select("id")
      .eq("tenant_id", project.tenant_id)
      .eq("name", laborRoleName)
      .maybeSingle();
    if (!roleData) {
      setContributingLoading(false);
      return;
    }
    const { data: rows, error } = await supabase
      .from("schedule_labor_weeks")
      .select(
        "headcount, hours_st, hours_ot, labor_role_id, " +
          "schedule_versions(version_number, projects(project_number, name))",
      )
      .eq("tenant_id", project.tenant_id)
      .eq("week_start_date", weekStartDate)
      .eq("labor_role_id", roleData.id);
    setContributingLoading(false);
    if (error) return;
    const mapped: ContributingDemandRow[] = (rows ?? [])
      .map((r: Record<string, unknown>) => {
        const sv = r.schedule_versions as Record<string, unknown> | null;
        const proj = (sv?.projects ?? {}) as Record<string, unknown>;
        const roleName =
          laborRoles.find((lr) => lr.id === r.labor_role_id)?.name ??
          laborRoleName;
        return {
          project_number: String(proj.project_number ?? "—"),
          project_name: String(proj.name ?? "—"),
          version_number: Number(sv?.version_number ?? 0),
          labor_role: roleName,
          demand_headcount: Number(r.headcount ?? 0),
          demand_hours:
            Number(r.hours_st ?? 0) + Number(r.hours_ot ?? 0),
        };
      })
      .filter((r) => r.project_number !== "—" || r.project_name !== "—");
    setContributingRows(mapped);
  }

  async function saveLaborRow(draft: LaborRowDraft, currentVersionId: string) {
    if (!project) return;
    const validationErr = validateLaborDraft(draft);
    if (validationErr) {
      setLaborError(validationErr);
      return;
    }
    setSavingRow(true);
    setLaborError(null);
    const snapped = snapToMonday(draft.week_start_date);
    const payload = {
      tenant_id: project.tenant_id,
      schedule_version_id: currentVersionId,
      week_start_date: snapped,
      labor_role_id: draft.labor_role_id || null,
      headcount: numOrNull(draft.headcount),
      hours_st: numOrNull(draft.hours_st),
      hours_ot: numOrNull(draft.hours_ot),
    };
    if (draft.id) {
      const { error } = await supabase
        .from("schedule_labor_weeks")
        .update({
          week_start_date: payload.week_start_date,
          labor_role_id: payload.labor_role_id,
          headcount: payload.headcount,
          hours_st: payload.hours_st,
          hours_ot: payload.hours_ot,
        })
        .eq("id", draft.id)
        .eq("schedule_version_id", currentVersionId);
      if (error) {
        setLaborError(error.message);
        setSavingRow(false);
        return;
      }
      setLaborRowToast("Labor row updated.");
      setTimeout(() => setLaborRowToast(null), 4000);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("schedule_labor_weeks")
        .insert({ ...payload, created_by: user?.id ?? null });
      if (error) {
        setLaborError(error.message);
        setSavingRow(false);
        return;
      }
    }
    setEditingDraft(null);
    setAddingDraft(null);
    setSavingRow(false);
    await reloadAfterLaborMutation(currentVersionId);
  }

  async function deleteLaborRow(rowId: string, currentVersionId: string) {
    if (!project) return;
    setLaborError(null);
    setDeletingRow(true);
    const { error } = await supabase
      .from("schedule_labor_weeks")
      .delete()
      .eq("id", rowId)
      .eq("schedule_version_id", currentVersionId)
      .eq("tenant_id", project.tenant_id);
    setDeletingRow(false);
    if (error) {
      setLaborError(error.message);
      return;
    }
    setDeleteRowTarget(null);
    setLaborRowToast("Labor row deleted.");
    setTimeout(() => setLaborRowToast(null), 4000);
    await reloadAfterLaborMutation(currentVersionId);
  }

  async function handleCreateExposure(draft: {
    title: string;
    cause_type: string;
    status: string;
    attachToVersion: boolean;
    laborHoursDelta: string;
    laborCostDelta: string;
    materialCostDelta: string;
  }) {
    if (!project) return;
    setCreateExposureSaving(true);
    const laborH = numOrNull(draft.laborHoursDelta) ?? 0;
    const laborC = numOrNull(draft.laborCostDelta) ?? 0;
    const materialC = numOrNull(draft.materialCostDelta) ?? 0;
    const { error } = await supabase.from("financial_exposures").insert({
      tenant_id: project.tenant_id,
      project_id: id,
      schedule_version_id: draft.attachToVersion && currentVersion
        ? currentVersion.id
        : null,
      title: draft.title,
      cause_type: draft.cause_type,
      status: draft.status,
      estimated_labor_hours_delta: laborH,
      estimated_labor_cost_delta: laborC,
      estimated_material_cost_delta: materialC,
    });
    setCreateExposureSaving(false);
    if (error) {
      setCreateExposureError(error.message);
      return;
    }
    setShowCreateExposureModal(false);
    setLaborRowToast("Financial exposure created.");
    setTimeout(() => setLaborRowToast(null), 4000);
    await loadAll();
    document.getElementById("exposures-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleCreateCOFromExposure(draft: {
    project_id: string;
    financial_exposure_id: string | null;
    co_number: string;
    title: string;
    status: string;
    amount: string;
  }) {
    if (!project) return;
    setCreateCOSaving(true);
    setCreateCOError(null);
    const amountNum = Number(draft.amount);
    const { error } = await supabase.from("change_orders").insert({
      tenant_id: project.tenant_id,
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
    setLaborRowToast("Change order created from exposure.");
    setTimeout(() => setLaborRowToast(null), 4000);
    await loadAll();
  }

  const EXPOSURE_STATUSES = ["open", "pending", "closed"] as const;

  async function handleEditExposure(draft: {
    title: string;
    cause_type: string;
    laborHoursDelta: string;
    laborCostDelta: string;
    materialCostDelta: string;
    scheduleVersionChoice: "keep" | "attach" | "clear";
  }) {
    if (!project || !editingExposure) return;
    setEditingExposureSaving(true);
    setEditingExposureError(null);
    let scheduleVersionId: string | null = editingExposure.schedule_version_id;
    if (draft.scheduleVersionChoice === "attach" && currentVersion)
      scheduleVersionId = currentVersion.id;
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
      .eq("tenant_id", project.tenant_id);
    setEditingExposureSaving(false);
    if (error) {
      setEditingExposureError(error.message);
      return;
    }
    setEditingExposure(null);
    setLaborRowToast("Exposure updated.");
    setTimeout(() => setLaborRowToast(null), 4000);
    await loadAll();
  }

  async function updateExposureStatus(expId: string, newStatus: string) {
    if (!project || !EXPOSURE_STATUSES.includes(newStatus as (typeof EXPOSURE_STATUSES)[number]))
      return;
    setStatusUpdatingId(expId);
    const { error } = await supabase
      .from("financial_exposures")
      .update({ status: newStatus })
      .eq("id", expId)
      .eq("tenant_id", project.tenant_id);
    setStatusUpdatingId(null);
    if (error) {
      setLaborError(error.message);
      return;
    }
    setLaborError(null);
    setLaborRowToast("Exposure status updated.");
    setTimeout(() => setLaborRowToast(null), 4000);
    await loadAll();
  }

  // ─── Derived data ──────────────────────────────────────────────────────────
  const currentVersion = scheduleVersions.find((v) => v.is_current) ?? null;
  const roleNameById = Object.fromEntries(
    laborRoles.map((r) => [r.id, r.name]),
  );
  const versionById = Object.fromEntries(
    scheduleVersions.map((v) => [v.id, v]),
  );
  const isViewingCurrent = !viewingVersionId;
  const displayedWeeks = isViewingCurrent ? laborWeeks : switchedLaborWeeks;

  // Labor plan grouping
  const laborByDate: Record<string, LaborWeek[]> = {};
  for (const week of displayedWeeks) {
    if (!laborByDate[week.week_start_date])
      laborByDate[week.week_start_date] = [];
    laborByDate[week.week_start_date].push(week);
  }
  const sortedDates = Object.keys(laborByDate).sort();
  for (const date of sortedDates) {
    laborByDate[date].sort((a, b) => {
      const na = a.labor_role_id ? (roleNameById[a.labor_role_id] ?? "") : "";
      const nb = b.labor_role_id ? (roleNameById[b.labor_role_id] ?? "") : "";
      return na.localeCompare(nb);
    });
  }

  // Grand totals (always current version rows for KPIs)
  const grandTotals = sumWeekRows(laborWeeks);
  const distinctWeeks = new Set(laborWeeks.map((w) => w.week_start_date)).size;

  // Capacity panel derived data
  const demandRows = buildDemandRows(displayedWeeks, roleNameById);

  // Weeks present in the currently displayed labor plan — used to filter capacity context
  const displayedWeekDates = new Set(
    displayedWeeks.map((w) => w.week_start_date),
  );
  const filteredCapacityRows = capacityRows.filter((r) =>
    displayedWeekDates.has(r.week_start_date),
  );

  // ─── Render states ─────────────────────────────────────────────────────────
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;
  if (!project)
    return <p style={{ color: "var(--muted)", padding: 40 }}>Project not found.</p>;

  // ─── Main render ───────────────────────────────────────────────────────────
  return (
    <div
      className="pi-page"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 960,
        width: "100%",
      }}
    >
      {showModal && currentVersion && (
        <CreateVersionModal
          currentVersionNum={currentVersion.version_number}
          creating={creating}
          createError={createError}
          revisionReason={revisionReason}
          onRevisionReasonChange={setRevisionReason}
          onConfirm={handleCreateVersion}
          onCancel={() => {
            setShowModal(false);
            setRevisionReason("internal");
            setCreateError(null);
          }}
        />
      )}

      {confirmationToast && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 90,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "12px 20px",
            fontSize: 13,
            color: C.primary,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {confirmationToast}
        </div>
      )}

      {laborRowToast && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 90,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "12px 20px",
            fontSize: 13,
            color: C.primary,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {laborRowToast}
        </div>
      )}

      {editingDraft?.id && currentVersion && (
        <EditLaborRowModal
          draft={editingDraft}
          laborRoles={laborRoles}
          saving={savingRow}
          laborError={laborError}
          onDraftChange={setEditingDraft}
          onSave={() => saveLaborRow(editingDraft, currentVersion.id)}
          onCancel={() => {
            setEditingDraft(null);
            setLaborError(null);
          }}
        />
      )}

      {deleteRowTarget && (
        <ConfirmDeleteLaborRowModal
          roleLabel={deleteRowTarget.roleLabel}
          weekLabel={deleteRowTarget.weekLabel}
          deleting={deletingRow}
          onConfirm={() =>
            deleteLaborRow(deleteRowTarget.rowId, deleteRowTarget.versionId)
          }
          onCancel={() => setDeleteRowTarget(null)}
        />
      )}

      {showCreateExposureModal && (
        <CreateExposureModal
          currentVersionId={currentVersion?.id ?? null}
          saving={createExposureSaving}
          error={createExposureError}
          onSave={handleCreateExposure}
          onCancel={() => {
            setShowCreateExposureModal(false);
            setCreateExposureError(null);
          }}
        />
      )}

      {createCOFromExposure && project && (
        <CreateChangeOrderModal
          projects={[
            {
              id: project.id,
              project_number: project.project_number,
              name: project.name,
            },
          ]}
          exposures={exposures.map((x) => ({
            id: x.id,
            project_id: x.project_id,
            title: x.title,
          }))}
          selectedProjectId={project.id}
          prefillFromExposure={{
            id: createCOFromExposure.id,
            project_id: createCOFromExposure.project_id,
            title: createCOFromExposure.title,
            estimated_labor_cost_delta:
              createCOFromExposure.estimated_labor_cost_delta,
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
          currentVersionId={currentVersion?.id ?? null}
          linkedVersionLabel={
            editingExposure.schedule_version_id
              ? `v${versionById[editingExposure.schedule_version_id]?.version_number ?? "?"}`
              : null
          }
          saving={editingExposureSaving}
          error={editingExposureError}
          onSave={handleEditExposure}
          onCancel={() => {
            setEditingExposure(null);
            setEditingExposureError(null);
          }}
        />
      )}

      <Link
        href="/projects"
        style={{
          color: "var(--muted)",
          textDecoration: "none",
          fontSize: 13,
          fontWeight: 500,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        ← Back to Projects
      </Link>

      {/* ── Project header ───────────────────────────────────────────────────*/}
      <div
        className="pi-card-lift"
        style={{
          background:
            "linear-gradient(135deg, rgba(251,146,60,0.06) 0%, transparent 60%)",
          borderColor: "rgba(251,146,60,0.25)",
          padding: "24px 28px",
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span className="pi-badge pi-badge-warn" style={{ textTransform: "none" }}>
            {project.project_number}
          </span>
          <StatusBadge status={project.status} />
          <Link
            href="/help#workflow"
            style={{
              marginLeft: "auto",
              fontSize: 12,
              color: "var(--muted)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ opacity: 0.7 }}>?</span> Help
          </Link>
        </div>
        <h1
          className="pi-page-title"
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 700,
            color: "var(--text)",
            lineHeight: 1.3,
            letterSpacing: "-0.02em",
          }}
        >
          {project.name}
        </h1>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          {project.client_name && (
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              <span
                style={{
                  color: "var(--faint)",
                  marginRight: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Client
              </span>
              {project.client_name}
            </span>
          )}
          {project.location && (
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              <span
                style={{
                  color: "var(--faint)",
                  marginRight: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Location
              </span>
              {project.location}
            </span>
          )}
        </div>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────────*/}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 16,
        }}
      >
        <KpiCard label="Schedule Versions" value={scheduleVersions.length} />
        <KpiCard label="Labor Weeks" value={distinctWeeks} />
        <KpiCard label="Total Headcount" value={grandTotals.headcount} />
        <KpiCard label="Total ST Hours" value={grandTotals.hours_st} />
        <KpiCard label="Total OT Hours" value={grandTotals.hours_ot} />
        <KpiCard label="Exposures" value={exposures.length} />
      </section>

      {/* ── Exposure summary ──────────────────────────────────────────────────*/}
      <div
        className="pi-card"
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        {exposures.length > 0 ? (
          <>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                <strong style={{ color: "var(--text)" }}>
                  {exposures.length}
                </strong>{" "}
                exposure{exposures.length !== 1 ? "s" : ""}
              </span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                <strong
                  style={{
                    color:
                      exposures.filter(
                        (e) => (e.status ?? "").toLowerCase() === "open",
                      ).length > 0
                      ? "var(--warn)"
                      : "var(--text)",
                  }}
                >
                  {
                    exposures.filter(
                      (e) => (e.status ?? "").toLowerCase() === "open",
                    ).length
                  }
                </strong>{" "}
                open
              </span>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Btn
                onClick={() => {
                  setCreateExposureError(null);
                  setShowCreateExposureModal(true);
                }}
                variant="primary"
                small
              >
                Create Exposure
              </Btn>
              <Link
                href="/exposures"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--brand)",
                  textDecoration: "none",
                }}
              >
                View all exposures →
              </Link>
            </div>
          </>
        ) : (
          <>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--muted)",
                lineHeight: 1.4,
              }}
            >
              Client-driven or scope-change revisions create exposures. You can
              also create one manually.
            </p>
            <Btn
              onClick={() => {
                setCreateExposureError(null);
                setShowCreateExposureModal(true);
              }}
              variant="primary"
              small
            >
              Create Exposure
            </Btn>
          </>
        )}
      </div>

      {/* ── Schedule & version (primary focus) ─────────────────────────────────*/}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}
      >
        <Panel
          title="Current Schedule Version"
          accent
          action={
            isViewingCurrent ? (
              <Btn
                onClick={() => {
                  setCreateError(null);
                  setRevisionReason("internal");
                  setShowModal(true);
                }}
                variant="primary"
                small
              >
                Create New Version
              </Btn>
            ) : undefined
          }
        >
          {!currentVersion ? (
            <EmptyState label="No current schedule version." />
          ) : (
            <div style={{ paddingTop: 4 }}>
              <DataRow
                label="Version"
                value={`v${currentVersion.version_number}`}
              />
              <DataRow
                label="Created"
                value={formatDateTime(currentVersion.created_at)}
              />
            </div>
          )}
        </Panel>

        <Panel title="Schedule Version History">
          {scheduleVersions.length === 0 ? (
            <EmptyState label="No schedule versions found." />
          ) : (
            <div style={{ paddingTop: 4 }}>
              {scheduleVersions.map((v) => (
                <div
                  key={v.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "56px 64px 1fr",
                    gap: 12,
                    padding: "9px 0",
                    borderBottom: `1px solid ${C.borderFaint}`,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{ color: C.primary, fontSize: 13, fontWeight: 600 }}
                  >
                    v{v.version_number}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color: v.is_current ? C.green : C.faint,
                    }}
                  >
                    {v.is_current ? "Current" : "Prior"}
                  </span>
                  <span style={{ color: C.dim, fontSize: 12 }}>
                    {formatDateTime(v.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      {/* ── Weekly Labor Plan ────────────────────────────────────────────────*/}
      <Panel
        title={
          viewingVersionId && versionById[viewingVersionId]
            ? `Weekly Labor Plan — v${versionById[viewingVersionId].version_number} (Read-Only)`
            : `Weekly Labor Plan${currentVersion ? ` — v${currentVersion.version_number} (Current)` : ""}`
        }
        action={
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {scheduleVersions.length > 1 &&
              scheduleVersions.map((v) => {
                const isActive = viewingVersionId
                  ? v.id === viewingVersionId
                  : v.is_current;
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      setAddingDraft(null);
                      setEditingDraft(null);
                      switchToVersion(v.id);
                    }}
                    disabled={switchLoading}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--r-sm)",
                      fontFamily: "inherit",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: switchLoading ? "not-allowed" : "pointer",
                      border: isActive
                        ? "1px solid rgba(251,146,60,0.5)"
                        : "1px solid var(--border)",
                      background: isActive
                        ? "rgba(251,146,60,0.12)"
                        : "var(--panel-lift)",
                      color: isActive ? "var(--brand)" : "var(--muted)",
                      opacity: switchLoading ? 0.5 : 1,
                    }}
                  >
                    v{v.version_number}
                    {v.is_current ? " (current)" : ""}
                  </button>
                );
              })}
            {isViewingCurrent && currentVersion && !addingDraft && (
              <Btn
                onClick={() => {
                  setLaborError(null);
                  setEditingDraft(null);
                  setAddingDraft({ ...EMPTY_DRAFT });
                }}
                variant="primary"
                small
              >
                Add Labor Row
              </Btn>
            )}
          </div>
        }
      >
        {!isViewingCurrent && (
          <div
            style={{
              margin: "0 0 16px",
              padding: "12px 16px",
              background: "rgba(250,204,21,0.06)",
              border: "1px solid rgba(250,204,21,0.25)",
              borderRadius: "var(--r-sm)",
              fontSize: 13,
              color: "var(--warn)",
            }}
          >
            Read-only prior version — switch to the current version to edit.
          </div>
        )}
        {isViewingCurrent && currentVersion && addingDraft && (
          <div style={{ marginTop: 12 }}>
            <LaborRowForm
              draft={addingDraft}
              laborRoles={laborRoles}
              saving={savingRow}
              onDraftChange={setAddingDraft}
              onSave={() => saveLaborRow(addingDraft, currentVersion.id)}
              onCancel={() => {
                setAddingDraft(null);
                setLaborError(null);
              }}
              validationError={validateLaborDraft(addingDraft)}
            />
          </div>
        )}
        {laborError && (
          <div style={{ marginTop: 8 }}>
            <ErrorBanner message={laborError} />
          </div>
        )}
        {switchLoading ? (
          <LoadingSpinner label="Loading version..." />
        ) : sortedDates.length === 0 ? (
          <EmptyState label="No labor weeks found for this version." />
        ) : (
          <div style={{ display: "grid", gap: 16, paddingTop: 12 }}>
            {sortedDates.map((date) => {
              const rows = laborByDate[date];
              const totals = sumWeekRows(rows);
              return (
                <div
                  key={date}
                  style={{
                    border: "1px solid var(--border-faint)",
                    borderRadius: "var(--r-sm)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "12px 16px",
                      background: "var(--panel-lift)",
                      borderBottom: "1px solid var(--border-faint)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--muted)",
                    }}
                  >
                    Week of {formatWeekLabel(date)}
                  </div>
                  <div style={{ padding: "0 14px" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: isViewingCurrent
                          ? "1fr 80px 80px 80px 80px"
                          : "1fr 80px 80px 80px",
                        gap: 10,
                        padding: "7px 0 5px",
                        borderBottom: `1px solid ${C.borderFaint}`,
                      }}
                    >
                      {[
                        "Role",
                        "Headcount",
                        "ST Hrs",
                        "OT Hrs",
                        ...(isViewingCurrent ? [""] : []),
                      ].map((h, i) => (
                        <ColHead key={i} label={h} />
                      ))}
                    </div>
                    {rows.map((week) => (
                        <div
                          key={week.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: isViewingCurrent
                              ? "1fr 80px 80px 80px 80px"
                              : "1fr 80px 80px 80px",
                            gap: 10,
                            padding: "9px 0",
                            borderBottom: `1px solid ${C.borderFaint}`,
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              color: C.orange,
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          >
                            {week.labor_role_id
                              ? (roleNameById[week.labor_role_id] ??
                                "Unknown Role")
                              : "—"}
                          </span>
                          <span style={{ color: C.muted, fontSize: 13 }}>
                            {week.headcount ?? "—"}
                          </span>
                          <span style={{ color: C.muted, fontSize: 13 }}>
                            {week.hours_st ?? "—"}
                          </span>
                          <span style={{ color: C.muted, fontSize: 13 }}>
                            {week.hours_ot ?? "—"}
                          </span>
                          {isViewingCurrent && currentVersion && (
                            <div style={{ display: "flex", gap: 6 }}>
                              <Btn
                                onClick={() => {
                                  setLaborError(null);
                                  setAddingDraft(null);
                                  setEditingDraft({
                                    id: week.id,
                                    week_start_date: week.week_start_date,
                                    labor_role_id: week.labor_role_id ?? "",
                                    headcount:
                                      week.headcount != null
                                        ? String(week.headcount)
                                        : "",
                                    hours_st:
                                      week.hours_st != null
                                        ? String(week.hours_st)
                                        : "",
                                    hours_ot:
                                      week.hours_ot != null
                                        ? String(week.hours_ot)
                                        : "",
                                  });
                                }}
                                variant="ghost"
                                small
                              >
                                Edit
                              </Btn>
                              <Btn
                                onClick={() => {
                                  setLaborError(null);
                                  setDeleteRowTarget({
                                    rowId: week.id,
                                    versionId: currentVersion.id,
                                    roleLabel:
                                      week.labor_role_id
                                        ? (roleNameById[week.labor_role_id] ??
                                            "Unknown Role")
                                        : "—",
                                    weekLabel: formatWeekLabel(
                                      week.week_start_date,
                                    ),
                                  });
                                }}
                                variant="danger"
                                small
                              >
                                Del
                              </Btn>
                            </div>
                          )}
                        </div>
                      ))}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: isViewingCurrent
                          ? "1fr 80px 80px 80px 80px"
                          : "1fr 80px 80px 80px",
                        gap: 10,
                        padding: "10px 0 8px",
                        borderTop: "1px solid rgba(251,146,60,0.2)",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                          color: C.orange,
                        }}
                      >
                        Total
                      </span>
                      <span
                        style={{
                          color: C.orange,
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {totals.headcount}
                      </span>
                      <span
                        style={{
                          color: C.orange,
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {totals.hours_st}
                      </span>
                      <span
                        style={{
                          color: C.orange,
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {totals.hours_ot}
                      </span>
                      {isViewingCurrent && <span />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* ── Capacity & Exposures ─────────────────────────────────────────────*/}
      <div style={{ marginTop: 8 }} id="capacity-forecast">
        <Panel title="Capacity Forecast">
        {/* ── Section 1: Project Demand ──────────────────────────────────────*/}
        <SectionLabel
          label={`Project Demand — ${isViewingCurrent ? "Current Version" : `v${versionById[viewingVersionId!]?.version_number ?? "?"}`}`}
        />
        {demandRows.length === 0 ? (
          <EmptyState label="No labor weeks to summarize." />
        ) : (
          <div style={{ marginBottom: 8 }}>
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr 100px 100px",
                gap: 10,
                padding: "6px 0 6px",
                borderBottom: `1px solid ${C.borderFaint}`,
              }}
            >
              {["Week", "Role", "Headcount", "Total Hrs"].map((h) => (
                <ColHead key={h} label={h} />
              ))}
            </div>
            {demandRows.map((row, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr 100px 100px",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom: `1px solid ${C.borderFaint}`,
                  alignItems: "center",
                }}
              >
                <span style={{ color: C.dim, fontSize: 12 }}>
                  {formatWeekLabel(row.week_start_date)}
                </span>
                <span
                  style={{ color: C.orange, fontSize: 13, fontWeight: 600 }}
                >
                  {row.labor_role}
                </span>
                <span style={{ color: C.muted, fontSize: 13 }}>
                  {row.headcount}
                </span>
                <span style={{ color: C.muted, fontSize: 13 }}>
                  {row.total_hours}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Section 2: Company Capacity Context ───────────────────────────*/}
        <SectionLabel label="Company Capacity Context" />
        {filteredCapacityRows.length === 0 ? (
          <EmptyState label="No capacity forecast data for the weeks in this labor plan." />
        ) : (
          <div>
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "130px 1fr 80px 80px 80px 80px 80px 80px 90px",
                gap: 8,
                padding: "6px 0 6px",
                borderBottom: `1px solid ${C.borderFaint}`,
              }}
            >
              {[
                "Week",
                "Role",
                "Dem Hrs",
                "Avail Hrs",
                "Net Hrs",
                "Dem HC",
                "Avail HC",
                "Net HC",
                "Status",
              ].map((h) => (
                <ColHead key={h} label={h} />
              ))}
            </div>
            {filteredCapacityRows.map((row, i) => {
              const sc = capacityStatusColors(row.status);
              const isSelected =
                selectedForecastRow?.week_start_date === row.week_start_date &&
                selectedForecastRow?.labor_role === row.labor_role;
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSelectedForecastRow(
                      isSelected
                        ? null
                        : {
                            week_start_date: row.week_start_date,
                            labor_role: row.labor_role ?? "",
                          },
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedForecastRow(
                        isSelected
                          ? null
                          : {
                              week_start_date: row.week_start_date,
                              labor_role: row.labor_role ?? "",
                            },
                      );
                    }
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "130px 1fr 80px 80px 80px 80px 80px 80px 90px",
                    gap: 8,
                    padding: "8px 0",
                    borderBottom: `1px solid ${C.borderFaint}`,
                    alignItems: "center",
                    cursor: "pointer",
                    background: isSelected
                      ? "rgba(251,146,60,0.1)"
                      : "transparent",
                  }}
                >
                  <span style={{ color: C.dim, fontSize: 12 }}>
                    {formatWeekLabel(row.week_start_date)}
                  </span>
                  <span style={{ color: C.muted, fontSize: 13 }}>
                    {row.labor_role ?? "—"}
                  </span>
                  <span style={{ color: C.muted, fontSize: 12 }}>
                    {row.demand_hours != null
                      ? Number(row.demand_hours).toFixed(0)
                      : "—"}
                  </span>
                  <span style={{ color: C.muted, fontSize: 12 }}>
                    {row.available_hours != null
                      ? Number(row.available_hours).toFixed(0)
                      : "—"}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: Number(row.net_hours ?? 0) < 0 ? C.red : C.muted,
                    }}
                  >
                    {row.net_hours != null
                      ? Number(row.net_hours).toFixed(0)
                      : "—"}
                  </span>
                  <span style={{ color: C.muted, fontSize: 12 }}>
                    {row.demand_headcount != null
                      ? Number(row.demand_headcount).toFixed(0)
                      : "—"}
                  </span>
                  <span style={{ color: C.muted, fontSize: 12 }}>
                    {row.available_headcount != null
                      ? Number(row.available_headcount).toFixed(0)
                      : "—"}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color:
                        Number(row.net_headcount ?? 0) < 0 ? C.red : C.muted,
                    }}
                  >
                    {row.net_headcount != null
                      ? Number(row.net_headcount).toFixed(0)
                      : "—"}
                  </span>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 7px",
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                      color: sc.text,
                      background: sc.bg,
                      border: `1px solid ${sc.border}`,
                    }}
                  >
                    {row.status ?? "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Forecast drilldown ─────────────────────────────────────────────*/}
        {selectedForecastRow && (
          <div
            style={{
              marginTop: 16,
              padding: "16px 20px",
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.primary,
                }}
              >
                Forecast Drilldown — {selectedForecastRow.labor_role} — Week of{" "}
                {formatWeekLabel(selectedForecastRow.week_start_date)}
              </h4>
              <Btn
                onClick={() => setSelectedForecastRow(null)}
                variant="ghost"
                small
              >
                Close
              </Btn>
            </div>
            {(() => {
              const row = filteredCapacityRows.find(
                (r) =>
                  r.week_start_date === selectedForecastRow.week_start_date &&
                  r.labor_role === selectedForecastRow.labor_role,
              );
              if (!row) return null;
              return (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(100px, 1fr))",
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    {[
                      ["Demand Hrs", row.demand_hours],
                      ["Available Hrs", row.available_hours],
                      ["Net Hrs", row.net_hours],
                      ["Demand HC", row.demand_headcount],
                      ["Available HC", row.available_headcount],
                      ["Net HC", row.net_headcount],
                      ["Status", row.status],
                    ].map(([label, val]) => (
                      <div
                        key={String(label)}
                        style={{
                          padding: "8px 12px",
                          background: "var(--panel-lift)",
                          borderRadius: 6,
                          border: `1px solid ${C.borderFaint}`,
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: C.faint,
                            marginBottom: 4,
                          }}
                        >
                          {label}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: C.muted,
                          }}
                        >
                          {typeof val === "number"
                            ? val != null
                              ? Number(val).toFixed(0)
                              : "—"
                            : val ?? "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <SectionLabel label="Contributing Demand" />
                  {contributingLoading ? (
                    <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
                      Loading...
                    </p>
                  ) : contributingRows.length > 0 ? (
                    <div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "100px 1fr 70px 1fr 80px 80px",
                          gap: 8,
                          padding: "6px 0 6px",
                          borderBottom: `1px solid ${C.borderFaint}`,
                        }}
                      >
                        {[
                          "Project #",
                          "Project",
                          "Version",
                          "Role",
                          "Dem HC",
                          "Dem Hrs",
                        ].map((h) => (
                          <ColHead key={h} label={h} />
                        ))}
                      </div>
                      {contributingRows.map((r, i) => (
                        <div
                          key={i}
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "100px 1fr 70px 1fr 80px 80px",
                            gap: 8,
                            padding: "8px 0",
                            borderBottom: `1px solid ${C.borderFaint}`,
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontSize: 12, color: C.muted }}>
                            {r.project_number}
                          </span>
                          <span style={{ fontSize: 12, color: C.primary }}>
                            {r.project_name}
                          </span>
                          <span style={{ fontSize: 12, color: C.dim }}>
                            v{r.version_number}
                          </span>
                          <span style={{ fontSize: 12, color: C.muted }}>
                            {r.labor_role}
                          </span>
                          <span style={{ fontSize: 12, color: C.muted }}>
                            {r.demand_headcount}
                          </span>
                          <span style={{ fontSize: 12, color: C.muted }}>
                            {r.demand_hours}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: C.muted,
                        fontStyle: "italic",
                      }}
                    >
                      Detailed contributing demand rows are not available yet for
                      this forecast source.
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        )}
        </Panel>

        <div id="exposures-section" style={{ marginTop: 24 }}>
          <Panel title="Financial Exposures">
        {exposures.length === 0 ? (
          <EmptyState label="No exposures found." />
        ) : (
          <div style={{ display: "grid", gap: 0, paddingTop: 4 }}>
            {exposures.map((exp) => {
              const linkedVersion = exp.schedule_version_id
                ? versionById[exp.schedule_version_id]
                : null;
              return (
                <div
                  key={exp.id}
                  style={{
                    padding: "14px 0",
                    borderBottom: `1px solid ${C.borderFaint}`,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        color: C.primary,
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      {exp.title ?? "Untitled Exposure"}
                    </span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select
                      value={
                        ["open", "pending", "closed"].includes(
                          (exp.status ?? "").toLowerCase(),
                        )
                          ? (exp.status ?? "").toLowerCase()
                          : "open"
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v && ["open", "pending", "closed"].includes(v))
                          updateExposureStatus(exp.id, v);
                      }}
                      disabled={statusUpdatingId === exp.id}
                      style={{
                        padding: "4px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        background:
                          STATUS_MAP[(exp.status ?? "").toLowerCase()]?.bg ??
                          C.surface,
                        border: `1px solid ${
                          STATUS_MAP[(exp.status ?? "").toLowerCase()]?.border ??
                          C.border
                        }`,
                        borderRadius: 4,
                        color:
                          STATUS_MAP[(exp.status ?? "").toLowerCase()]?.text ??
                          C.primary,
                        cursor: statusUpdatingId === exp.id ? "not-allowed" : "pointer",
                      }}
                    >
                      <option value="open">Open</option>
                      <option value="pending">Pending</option>
                      <option value="closed">Closed</option>
                    </select>
                    {coByExposureId[exp.id] ? (
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
                          {coByExposureId[exp.id].co_number}
                        </Link>
                        <span
                          className={coStatusBadgeClass(coByExposureId[exp.id].status)}
                          style={{
                            padding: "2px 6px",
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                          }}
                        >
                          {coByExposureId[exp.id].status}
                        </span>
                      </div>
                    ) : (
                      <Btn
                        onClick={() => {
                          setCreateCOError(null);
                          setCreateCOFromExposure(exp);
                        }}
                        variant="ghost"
                        small
                      >
                        Create CO
                      </Btn>
                    )}
                    <Btn
                      onClick={() => {
                        setEditingExposureError(null);
                        setEditingExposure(exp);
                      }}
                      variant="ghost"
                      small
                    >
                      Edit
                    </Btn>
                    </div>
                  </div>
                  {exp.description && (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: C.muted,
                        lineHeight: 1.5,
                      }}
                    >
                      {exp.description}
                    </p>
                  )}
                  <div
                    style={{
                      display: "flex",
                      gap: 20,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 12, color: C.dim }}>
                      <span
                        style={{
                          color: C.faint,
                          marginRight: 4,
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                        }}
                      >
                        Cause
                      </span>
                      {exp.cause_type ?? "—"}
                    </span>
                    {linkedVersion && (
                      <span style={{ fontSize: 12, color: C.dim }}>
                        <span
                          style={{
                            color: C.faint,
                            marginRight: 4,
                            fontSize: 10,
                            textTransform: "uppercase",
                            letterSpacing: "0.07em",
                          }}
                        >
                          Schedule
                        </span>
                        v{linkedVersion.version_number}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: 8,
                    }}
                  >
                    {[
                      {
                        label: "Labor Hrs Δ",
                        value:
                          exp.estimated_labor_hours_delta != null
                            ? String(exp.estimated_labor_hours_delta)
                            : "—",
                      },
                      {
                        label: "Labor Cost Δ",
                        value: formatCurrency(exp.estimated_labor_cost_delta),
                      },
                      {
                        label: "Material Cost Δ",
                        value: formatCurrency(
                          exp.estimated_material_cost_delta,
                        ),
                      },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        style={{
                          background: C.surface,
                          border: `1px solid ${C.borderFaint}`,
                          borderRadius: 5,
                          padding: "8px 12px",
                          display: "grid",
                          gap: 3,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: C.faint,
                          }}
                        >
                          {label}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: C.muted,
                          }}
                        >
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: C.faint }}>
                    {formatDateTime(exp.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
