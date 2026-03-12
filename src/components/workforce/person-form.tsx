"use client";

// components/workforce/person-form.tsx
//
// Handles both create and edit mode.
// No modal, no toast system, no form library.
// Pass editTarget to enter edit mode; null for create mode.
// onSuccess receives the saved person so the wrapper can update local state.

import { useState, useEffect } from "react";
import type {
  Personnel,
  LaborRole,
} from "@/src/lib/supabase/queries/workforce";

type PersonnelWritePayload = {
  full_name: string;
  employee_code: string;
  labor_role_id: string | null;
  active: boolean;
  skill_level: string;
  travel_ready: boolean;
  home_location: string;
  notes: string;
};

type Props = {
  laborRoles: LaborRole[];
  editTarget: Personnel | null; // null = create mode
  tenantId: string;
  onSuccess: (person: Personnel) => void;
  onCancel: () => void;
};

const EMPTY: PersonnelWritePayload = {
  full_name: "",
  employee_code: "",
  labor_role_id: null,
  active: true,
  skill_level: "",
  travel_ready: false,
  home_location: "",
  notes: "",
};

function toPayload(p: Personnel): PersonnelWritePayload {
  return {
    full_name: p.full_name ?? "",
    employee_code: (p as any).employee_code ?? "",
    labor_role_id: p.labor_role_id ?? null,
    active: p.active ?? true,
    skill_level: (p as any).skill_level ?? "",
    travel_ready: (p as any).travel_ready ?? false,
    home_location: (p as any).home_location ?? "",
    notes: (p as any).notes ?? "",
  };
}

export function PersonForm({
  laborRoles,
  editTarget,
  tenantId,
  onSuccess,
  onCancel,
}: Props) {
  const [fields, setFields] = useState<PersonnelWritePayload>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync form when editTarget changes
  useEffect(() => {
    setFields(editTarget ? toPayload(editTarget) : EMPTY);
    setError(null);
  }, [editTarget?.id]);

  function set<K extends keyof PersonnelWritePayload>(
    key: K,
    value: PersonnelWritePayload[K],
  ) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Minimal real validation
    if (!fields.full_name.trim()) {
      setError("Full name is required.");
      return;
    }

    try {
      setSaving(true);

      // Inline fetch call — no server action needed for slice 2.
      // PLUG IN: swap this for a Server Action or API route if you
      // want to avoid exposing the Supabase client in client components.
      // For now this assumes you have a client-side Supabase instance available.
      const res = await fetch("/api/workforce/personnel", {
        method: editTarget ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          personId: editTarget?.id ?? null,
          payload: fields,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed: ${res.status}`);
      }

      const saved: Personnel = await res.json();
      onSuccess(saved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const isEdit = !!editTarget;

  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <span style={{ color: "#e5e5e5", fontSize: 14, fontWeight: 600 }}>
          {isEdit ? `Edit: ${editTarget.full_name}` : "Add Person"}
        </span>
        <button onClick={onCancel} style={cancelBtn} disabled={saving}>
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={grid}>
          {/* full_name */}
          <div style={field}>
            <label style={lbl}>Full Name *</label>
            <input
              style={inp}
              value={fields.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder="Jane Smith"
              disabled={saving}
            />
          </div>

          {/* employee_code */}
          <div style={field}>
            <label style={lbl}>Employee Code</label>
            <input
              style={inp}
              value={fields.employee_code}
              onChange={(e) => set("employee_code", e.target.value)}
              placeholder="EMP-001"
              disabled={saving}
            />
          </div>

          {/* labor_role_id */}
          <div style={field}>
            <label style={lbl}>Labor Role</label>
            <select
              style={inp}
              value={fields.labor_role_id ?? ""}
              onChange={(e) => set("labor_role_id", e.target.value || null)}
              disabled={saving}
            >
              <option value="">— select role —</option>
              {laborRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* skill_level */}
          <div style={field}>
            <label style={lbl}>Skill Level</label>
            <select
              style={inp}
              value={fields.skill_level}
              onChange={(e) => set("skill_level", e.target.value)}
              disabled={saving}
            >
              <option value="">— select —</option>
              <option value="apprentice">Apprentice</option>
              <option value="journeyman">Journeyman</option>
              <option value="foreman">Foreman</option>
              <option value="superintendent">Superintendent</option>
            </select>
          </div>

          {/* home_location */}
          <div style={field}>
            <label style={lbl}>Home Location</label>
            <input
              style={inp}
              value={fields.home_location}
              onChange={(e) => set("home_location", e.target.value)}
              placeholder="New Orleans, LA"
              disabled={saving}
            />
          </div>

          {/* is_active + travel_ready side by side */}
          <div
            style={{
              ...field,
              flexDirection: "row",
              gap: 20,
              alignItems: "flex-end",
            }}
          >
            <div style={field}>
              <label style={lbl}>Active</label>
              <select
                style={inp}
                value={fields.active ? "1" : "0"}
                onChange={(e) => set("active", e.target.value === "1")}
                disabled={saving}
              >
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </div>
            <div style={field}>
              <label style={lbl}>Travel Ready</label>
              <select
                style={inp}
                value={fields.travel_ready ? "1" : "0"}
                onChange={(e) => set("travel_ready", e.target.value === "1")}
                disabled={saving}
              >
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </div>
          </div>
        </div>

        {/* notes — full width */}
        <div style={{ ...field, marginTop: 10 }}>
          <label style={lbl}>Notes</label>
          <textarea
            style={{
              ...inp,
              height: 64,
              resize: "vertical",
              fontFamily: "inherit",
            }}
            value={fields.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Optional notes..."
            disabled={saving}
          />
        </div>

        {error && (
          <div style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <button type="submit" style={submitBtn} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Person"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#111",
  border: "1px solid #2a2a2a",
  borderRadius: 6,
  padding: 16,
  marginBottom: 20,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
  gap: 12,
};

const field: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const lbl: React.CSSProperties = {
  color: "#71717a",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inp: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #3f3f46",
  color: "#e5e5e5",
  padding: "6px 9px",
  borderRadius: 4,
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
};

const submitBtn: React.CSSProperties = {
  background: "#f97316",
  border: "none",
  color: "#fff",
  padding: "8px 20px",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const cancelBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid #3f3f46",
  color: "#71717a",
  padding: "4px 12px",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 12,
};
