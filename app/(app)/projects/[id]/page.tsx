"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

// ─── Create version modal ─────────────────────────────────────────────────────
function CreateVersionModal({
  currentVersionNum,
  creating,
  createError,
  clientDriven,
  onClientDrivenChange,
  onConfirm,
  onCancel,
}: {
  currentVersionNum: number;
  creating: boolean;
  createError: string | null;
  clientDriven: boolean;
  onClientDrivenChange: (v: boolean) => void;
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
          <label
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
              type="checkbox"
              checked={clientDriven}
              onChange={(e) => onClientDrivenChange(e.target.checked)}
              style={{
                width: 15,
                height: 15,
                accentColor: C.orange,
                cursor: "pointer",
                marginTop: 1,
              }}
            />
            <span>
              Client-driven revision
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  color: C.faint,
                  marginTop: 2,
                }}
              >
                Creates an open financial exposure linked to v
                {currentVersionNum}.
              </span>
            </span>
          </label>
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
}: {
  draft: LaborRowDraft;
  laborRoles: LaborRole[];
  saving: boolean;
  onDraftChange: (d: LaborRowDraft) => void;
  onSave: () => void;
  onCancel: () => void;
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
              <input
                key="wsd"
                type="date"
                value={draft.week_start_date}
                onChange={(e) =>
                  onDraftChange({ ...draft, week_start_date: e.target.value })
                }
                style={inputStyle}
              />,
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
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={onSave} disabled={saving} variant="primary" small>
          {saving ? "Saving..." : "Save"}
        </Btn>
        <Btn onClick={onCancel} disabled={saving} variant="ghost" small>
          Cancel
        </Btn>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = use(params);

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
  const [clientDriven, setClientDriven] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Labor row editing ──────────────────────────────────────────────────────
  const [editingDraft, setEditingDraft] = useState<LaborRowDraft | null>(null);
  const [addingDraft, setAddingDraft] = useState<LaborRowDraft | null>(null);
  const [savingRow, setSavingRow] = useState(false);
  const [laborError, setLaborError] = useState<string | null>(null);

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
    setExposures((exposureData ?? []) as unknown as FinancialExposure[]);

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

  async function handleCreateVersion() {
    setCreating(true);
    setCreateError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: rpcError } = await supabase.rpc("create_schedule_version", {
      p_project_id: id,
      p_client_driven: clientDriven,
      p_user_id: user?.id ?? null,
    });
    if (rpcError) {
      setCreateError(rpcError.message);
      setCreating(false);
      return;
    }
    setShowModal(false);
    setClientDriven(false);
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

  async function saveLaborRow(draft: LaborRowDraft, currentVersionId: string) {
    if (!project) return;
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
    if (!window.confirm("Delete this labor row? This cannot be undone."))
      return;
    setLaborError(null);
    const { error } = await supabase
      .from("schedule_labor_weeks")
      .delete()
      .eq("id", rowId)
      .eq("schedule_version_id", currentVersionId);
    if (error) {
      setLaborError(error.message);
      return;
    }
    await reloadAfterLaborMutation(currentVersionId);
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
          clientDriven={clientDriven}
          onClientDrivenChange={setClientDriven}
          onConfirm={handleCreateVersion}
          onCancel={() => {
            setShowModal(false);
            setClientDriven(false);
            setCreateError(null);
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
          </>
        ) : (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--muted)",
              lineHeight: 1.4,
            }}
          >
            Client-driven schedule revisions can create exposures. Create a new
            version and check &quot;Client-driven revision&quot; to generate one.
          </p>
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
                  setClientDriven(false);
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
                    {rows.map((week) => {
                      const isEditing = editingDraft?.id === week.id;
                      if (isEditing && isViewingCurrent && currentVersion) {
                        return (
                          <div key={week.id} style={{ padding: "8px 0" }}>
                            <LaborRowForm
                              draft={editingDraft}
                              laborRoles={laborRoles}
                              saving={savingRow}
                              onDraftChange={setEditingDraft}
                              onSave={() =>
                                saveLaborRow(editingDraft, currentVersion.id)
                              }
                              onCancel={() => {
                                setEditingDraft(null);
                                setLaborError(null);
                              }}
                            />
                          </div>
                        );
                      }
                      return (
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
                                onClick={() =>
                                  deleteLaborRow(week.id, currentVersion.id)
                                }
                                variant="danger"
                                small
                              >
                                Del
                              </Btn>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
      <div style={{ marginTop: 8 }}>
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
              return (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "130px 1fr 80px 80px 80px 80px 80px 80px 90px",
                    gap: 8,
                    padding: "8px 0",
                    borderBottom: `1px solid ${C.borderFaint}`,
                    alignItems: "center",
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
        </Panel>

        <div style={{ marginTop: 24 }}>
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
                    {exp.status && <StatusBadge status={exp.status} />}
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
