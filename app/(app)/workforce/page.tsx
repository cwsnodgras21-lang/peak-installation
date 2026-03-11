"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type LaborRole = {
  id: string;
  name: string;
  sort_order: number | null;
};

type AvailabilityRow = {
  id: string;
  tenant_id: string;
  week_start_date: string; // ISO date string "YYYY-MM-DD"
  labor_role_id: string | null;
  available_headcount: number | null;
  available_hours: number | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
};

type EditDraft = {
  id: string | null; // null = new row
  week_start_date: string;
  labor_role_id: string;
  available_headcount: string;
  available_hours: string;
  notes: string;
};

type PageState = "loading" | "error" | "ready";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Snap any date string to the Monday of its week (ISO: week starts Monday) */
function snapToMonday(dateStr: string): string {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

/** Format a "YYYY-MM-DD" date for display */
function fmtDate(dateStr: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${m}/${d}/${y}`;
}

/** Group rows by week_start_date, sorted newest first */
function groupByWeek(
  rows: AvailabilityRow[],
): Record<string, AvailabilityRow[]> {
  const groups: Record<string, AvailabilityRow[]> = {};
  for (const row of rows) {
    const key = row.week_start_date;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }
  return groups;
}

function emptyDraft(): EditDraft {
  return {
    id: null,
    week_start_date: "",
    labor_role_id: "",
    available_headcount: "",
    available_hours: "",
    notes: "",
  };
}

// ─────────────────────────────────────────────
// INLINE STYLES
// ─────────────────────────────────────────────

const S = {
  page: {
    padding: "24px 32px",
    fontFamily: "system-ui, sans-serif",
    maxWidth: 960,
    margin: "0 auto",
    color: "#e2e8f0",
  } as React.CSSProperties,

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    gap: 16,
  } as React.CSSProperties,

  title: {
    fontSize: 22,
    fontWeight: 700,
    margin: 0,
    color: "#f1f5f9",
  } as React.CSSProperties,

  subtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
  } as React.CSSProperties,

  btnPrimary: {
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  btnGhost: {
    background: "transparent",
    color: "#94a3b8",
    border: "1px solid #334155",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 12,
    cursor: "pointer",
  } as React.CSSProperties,

  btnDanger: {
    background: "transparent",
    color: "#f87171",
    border: "1px solid #7f1d1d",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 12,
    cursor: "pointer",
  } as React.CSSProperties,

  btnSave: {
    background: "#22c55e",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  } as React.CSSProperties,

  statusBox: (type: "loading" | "error" | "empty") => ({
    padding: "40px 24px",
    textAlign: "center" as const,
    color: type === "error" ? "#f87171" : "#64748b",
    fontSize: 14,
    border: "1px dashed #1e293b",
    borderRadius: 8,
  }),

  weekGroup: {
    marginBottom: 24,
    border: "1px solid #1e293b",
    borderRadius: 8,
    overflow: "hidden",
  } as React.CSSProperties,

  weekHeader: {
    background: "#0f172a",
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 600,
    color: "#cbd5e1",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
  } as React.CSSProperties,

  th: {
    background: "#0f172a",
    padding: "8px 12px",
    textAlign: "left" as const,
    color: "#64748b",
    fontWeight: 500,
    borderBottom: "1px solid #1e293b",
    fontSize: 12,
  } as React.CSSProperties,

  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #0f172a",
    verticalAlign: "middle" as const,
    color: "#cbd5e1",
  } as React.CSSProperties,

  input: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 4,
    padding: "5px 8px",
    color: "#e2e8f0",
    fontSize: 12,
    width: "100%",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  select: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 4,
    padding: "5px 8px",
    color: "#e2e8f0",
    fontSize: 12,
    width: "100%",
  } as React.CSSProperties,

  formRow: {
    background: "#162032",
    borderBottom: "1px solid #1e293b",
  } as React.CSSProperties,

  formCell: {
    padding: "8px 10px",
    verticalAlign: "middle" as const,
  } as React.CSSProperties,

  errorMsg: {
    color: "#f87171",
    fontSize: 12,
    marginTop: 8,
    padding: "8px 12px",
    background: "#1c0a0a",
    borderRadius: 4,
    border: "1px solid #7f1d1d",
  } as React.CSSProperties,

  actionBtns: {
    display: "flex",
    gap: 6,
    alignItems: "center",
  } as React.CSSProperties,
};

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────

export default function WorkforcePage() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<AvailabilityRow[]>([]);
  const [roles, setRoles] = useState<LaborRole[]>([]);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null); // row id pending delete
  const [formError, setFormError] = useState<string | null>(null);

  // ── LOAD ──────────────────────────────────

  const loadData = useCallback(async () => {
    setPageState("loading");
    setErrorMsg(null);

    const [availRes, rolesRes] = await Promise.all([
      supabase
        .from("workforce_availability_weeks")
        .select("*")
        .order("week_start_date", { ascending: false }),
      supabase
        .from("labor_roles")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true }),
    ]);

    if (availRes.error) {
      setErrorMsg(availRes.error.message);
      setPageState("error");
      return;
    }

    if (rolesRes.error) {
      setErrorMsg(rolesRes.error.message);
      setPageState("error");
      return;
    }

    setRows(availRes.data ?? []);
    setRoles(rolesRes.data ?? []);
    setPageState("ready");
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── ROLE LOOKUP ───────────────────────────

  const roleName = (id: string | null): string => {
    if (!id) return "—";
    return roles.find((r) => r.id === id)?.name ?? id;
  };

  // ── DRAFT HELPERS ─────────────────────────

  const startNew = () => {
    setFormError(null);
    setDraft(emptyDraft());
  };

  const startEdit = (row: AvailabilityRow) => {
    setFormError(null);
    setDraft({
      id: row.id,
      week_start_date: row.week_start_date,
      labor_role_id: row.labor_role_id ?? "",
      available_headcount: row.available_headcount?.toString() ?? "",
      available_hours: row.available_hours?.toString() ?? "",
      notes: row.notes ?? "",
    });
  };

  const cancelDraft = () => {
    setDraft(null);
    setFormError(null);
  };

  const setDraftField = (field: keyof EditDraft, value: string) => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  // ── VALIDATE ──────────────────────────────

  const validateDraft = (d: EditDraft): string | null => {
    if (!d.week_start_date) return "Week start date is required.";
    if (!d.available_headcount && !d.available_hours)
      return "Enter at least available headcount or available hours.";
    if (d.available_headcount && isNaN(Number(d.available_headcount)))
      return "Available headcount must be a number.";
    if (d.available_hours && isNaN(Number(d.available_hours)))
      return "Available hours must be a number.";
    return null;
  };

  // ── SAVE ──────────────────────────────────

  const handleSave = async () => {
    if (!draft) return;
    const err = validateDraft(draft);
    if (err) {
      setFormError(err);
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      week_start_date: snapToMonday(draft.week_start_date),
      labor_role_id: draft.labor_role_id || null,
      available_headcount:
        draft.available_headcount !== ""
          ? Number(draft.available_headcount)
          : null,
      available_hours:
        draft.available_hours !== "" ? Number(draft.available_hours) : null,
      notes: draft.notes || null,
    };

    let opError: { message: string } | null = null;

    if (draft.id) {
      const res = await supabase
        .from("workforce_availability_weeks")
        .update(payload)
        .eq("id", draft.id);
      opError = res.error;
    } else {
      const res = await supabase
        .from("workforce_availability_weeks")
        .insert(payload);
      opError = res.error;
    }

    setSaving(false);

    if (opError) {
      setFormError(opError.message);
      return;
    }

    setDraft(null);
    loadData();
  };

  // ── DELETE ────────────────────────────────

  const handleDelete = async (id: string) => {
    const res = await supabase
      .from("workforce_availability_weeks")
      .delete()
      .eq("id", id);

    setDeleteConfirm(null);

    if (res.error) {
      setErrorMsg(res.error.message);
      return;
    }

    loadData();
  };

  // ── RENDER ────────────────────────────────

  const weekGroups = groupByWeek(rows);
  const sortedWeeks = Object.keys(weekGroups).sort((a, b) =>
    b.localeCompare(a),
  );

  // Is the new-row form showing (no id = new)?
  const isAddingNew = draft !== null && draft.id === null;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Workforce Availability</h1>
          <p style={S.subtitle}>
            Weekly headcount and hours capacity by labor role. Used to assess
            manpower gaps against labor plans.
          </p>
        </div>
        {pageState === "ready" && !isAddingNew && (
          <button style={S.btnPrimary} onClick={startNew}>
            Add Week
          </button>
        )}
      </div>

      {/* Page-level error */}
      {errorMsg && (
        <div style={S.errorMsg}>
          {errorMsg}
          <button style={{ marginLeft: 12, ...S.btnGhost }} onClick={loadData}>
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {pageState === "loading" && (
        <div style={S.statusBox("loading")}>Loading workforce data...</div>
      )}

      {/* Error (no data) */}
      {pageState === "error" && !errorMsg && (
        <div style={S.statusBox("error")}>Failed to load data.</div>
      )}

      {/* Ready */}
      {pageState === "ready" && (
        <>
          {/* New row form — shown above the list */}
          {isAddingNew && draft && (
            <div style={{ ...S.weekGroup, marginBottom: 24 }}>
              <div style={S.weekHeader}>New Availability Entry</div>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Week Start (Monday)</th>
                    <th style={S.th}>Labor Role</th>
                    <th style={S.th}>Headcount</th>
                    <th style={S.th}>Hours</th>
                    <th style={S.th}>Notes</th>
                    <th style={S.th}></th>
                  </tr>
                </thead>
                <tbody>
                  <InlineForm
                    draft={draft}
                    roles={roles}
                    saving={saving}
                    formError={formError}
                    onChange={setDraftField}
                    onSave={handleSave}
                    onCancel={cancelDraft}
                  />
                </tbody>
              </table>
            </div>
          )}

          {/* Empty state */}
          {rows.length === 0 && !isAddingNew && (
            <div style={S.statusBox("empty")}>
              No availability records yet. Click Add Week to get started.
            </div>
          )}

          {/* Week groups */}
          {sortedWeeks.map((week) => (
            <div key={week} style={S.weekGroup}>
              <div style={S.weekHeader}>
                <span>Week of {fmtDate(week)}</span>
                <span style={{ fontSize: 12, color: "#475569" }}>
                  {weekGroups[week].length}{" "}
                  {weekGroups[week].length === 1 ? "entry" : "entries"}
                </span>
              </div>

              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Labor Role</th>
                    <th style={S.th}>Headcount</th>
                    <th style={S.th}>Hours</th>
                    <th style={S.th}>Notes</th>
                    <th style={S.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {weekGroups[week].map((row) => {
                    const isEditing = draft?.id === row.id;

                    if (isEditing && draft) {
                      return (
                        <InlineForm
                          key={row.id}
                          draft={draft}
                          roles={roles}
                          saving={saving}
                          formError={formError}
                          hideWeekField
                          onChange={setDraftField}
                          onSave={handleSave}
                          onCancel={cancelDraft}
                        />
                      );
                    }

                    return (
                      <tr key={row.id}>
                        <td style={S.td}>{roleName(row.labor_role_id)}</td>
                        <td style={S.td}>
                          {row.available_headcount != null
                            ? row.available_headcount
                            : "—"}
                        </td>
                        <td style={S.td}>
                          {row.available_hours != null
                            ? row.available_hours
                            : "—"}
                        </td>
                        <td
                          style={{ ...S.td, color: "#64748b", maxWidth: 200 }}
                        >
                          {row.notes || "—"}
                        </td>
                        <td style={S.td}>
                          {deleteConfirm === row.id ? (
                            <div style={S.actionBtns}>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "#f87171",
                                  marginRight: 4,
                                }}
                              >
                                Delete?
                              </span>
                              <button
                                style={S.btnDanger}
                                onClick={() => handleDelete(row.id)}
                              >
                                Yes
                              </button>
                              <button
                                style={S.btnGhost}
                                onClick={() => setDeleteConfirm(null)}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <div style={S.actionBtns}>
                              <button
                                style={S.btnGhost}
                                onClick={() => {
                                  setDeleteConfirm(null);
                                  startEdit(row);
                                }}
                                disabled={draft !== null}
                              >
                                Edit
                              </button>
                              <button
                                style={S.btnDanger}
                                onClick={() => setDeleteConfirm(row.id)}
                                disabled={draft !== null}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// INLINE FORM COMPONENT
// ─────────────────────────────────────────────

type InlineFormProps = {
  draft: EditDraft;
  roles: LaborRole[];
  saving: boolean;
  formError: string | null;
  hideWeekField?: boolean;
  onChange: (field: keyof EditDraft, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

function InlineForm({
  draft,
  roles,
  saving,
  formError,
  hideWeekField = false,
  onChange,
  onSave,
  onCancel,
}: InlineFormProps) {
  return (
    <>
      <tr style={S.formRow}>
        {!hideWeekField && (
          <td style={S.formCell}>
            <input
              type="date"
              style={S.input}
              value={draft.week_start_date}
              onChange={(e) => onChange("week_start_date", e.target.value)}
            />
          </td>
        )}
        <td style={S.formCell}>
          <select
            style={S.select}
            value={draft.labor_role_id}
            onChange={(e) => onChange("labor_role_id", e.target.value)}
          >
            <option value="">— No Role —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </td>
        <td style={S.formCell}>
          <input
            type="number"
            style={{ ...S.input, width: 80 }}
            placeholder="e.g. 4"
            value={draft.available_headcount}
            onChange={(e) => onChange("available_headcount", e.target.value)}
            min={0}
          />
        </td>
        <td style={S.formCell}>
          <input
            type="number"
            style={{ ...S.input, width: 80 }}
            placeholder="e.g. 160"
            value={draft.available_hours}
            onChange={(e) => onChange("available_hours", e.target.value)}
            min={0}
          />
        </td>
        <td style={S.formCell}>
          <input
            type="text"
            style={S.input}
            placeholder="Optional notes"
            value={draft.notes}
            onChange={(e) => onChange("notes", e.target.value)}
          />
        </td>
        <td style={S.formCell}>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={S.btnSave} onClick={onSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button style={S.btnGhost} onClick={onCancel} disabled={saving}>
              Cancel
            </button>
          </div>
        </td>
      </tr>
      {formError && (
        <tr style={S.formRow}>
          <td colSpan={hideWeekField ? 5 : 6} style={{ padding: "0 10px 8px" }}>
            <div style={S.errorMsg}>{formError}</div>
          </td>
        </tr>
      )}
    </>
  );
}
