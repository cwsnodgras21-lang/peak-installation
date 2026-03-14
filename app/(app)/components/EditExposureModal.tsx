"use client";

import { useState } from "react";

const C = {
  orange: "#fb923c",
  primary: "#f1f5f9",
  muted: "#94a3b8",
  faint: "#475569",
  border: "rgba(255,255,255,0.08)",
  surface: "rgba(255,255,255,0.025)",
};

const CAUSE_TYPE_OPTIONS = [
  { value: "client_driven", label: "Client-driven" },
  { value: "scope_change", label: "Scope change" },
  { value: "internal_risk", label: "Internal risk" },
  { value: "other", label: "Other" },
] as const;

export type ExposureForEdit = {
  id: string;
  title: string | null;
  cause_type: string | null;
  schedule_version_id: string | null;
  estimated_labor_hours_delta: number | null;
  estimated_labor_cost_delta: number | null;
  estimated_material_cost_delta: number | null;
};

export type EditExposureDraft = {
  title: string;
  cause_type: string;
  laborHoursDelta: string;
  laborCostDelta: string;
  materialCostDelta: string;
  scheduleVersionChoice: "keep" | "attach" | "clear";
};

function Btn({
  onClick,
  disabled,
  variant = "default",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "ghost";
  children: React.ReactNode;
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: {
      background: "var(--panel-lift)",
      color: "var(--text)",
      border: "1px solid var(--border)",
    },
    primary: { background: "var(--brand)", color: "#fff", border: "none" },
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
        padding: "8px 16px",
        borderRadius: "var(--r-sm)",
        fontFamily: "inherit",
        fontSize: 13,
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

export function EditExposureModal({
  exposure,
  currentVersionId,
  linkedVersionLabel,
  saving,
  error,
  onSave,
  onCancel,
}: {
  exposure: ExposureForEdit;
  currentVersionId: string | null;
  linkedVersionLabel: string | null;
  saving: boolean;
  error: string | null;
  onSave: (draft: EditExposureDraft) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(exposure.title ?? "");
  const [causeType, setCauseType] = useState(exposure.cause_type ?? "");
  const [laborHoursDelta, setLaborHoursDelta] = useState(
    String(exposure.estimated_labor_hours_delta ?? 0),
  );
  const [laborCostDelta, setLaborCostDelta] = useState(
    String(exposure.estimated_labor_cost_delta ?? 0),
  );
  const [materialCostDelta, setMaterialCostDelta] = useState(
    String(exposure.estimated_material_cost_delta ?? 0),
  );
  const [scheduleVersionChoice, setScheduleVersionChoice] = useState<
    "keep" | "attach" | "clear"
  >(
    exposure.schedule_version_id
      ? "keep"
      : currentVersionId
        ? "attach"
        : "clear",
  );

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
          Edit Exposure
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
          <div style={{ display: "grid", gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: C.faint,
              }}
            >
              Schedule Version Link
            </span>
            <div style={{ display: "grid", gap: 6 }}>
              {exposure.schedule_version_id && linkedVersionLabel && (
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
                    type="radio"
                    name="svLink"
                    checked={scheduleVersionChoice === "keep"}
                    onChange={() => setScheduleVersionChoice("keep")}
                    style={{ accentColor: C.orange }}
                  />
                  Keep current ({linkedVersionLabel})
                </label>
              )}
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
                    type="radio"
                    name="svLink"
                    checked={scheduleVersionChoice === "attach"}
                    onChange={() => setScheduleVersionChoice("attach")}
                    style={{ accentColor: C.orange }}
                  />
                  Attach to current schedule version
                </label>
              )}
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
                  type="radio"
                  name="svLink"
                  checked={scheduleVersionChoice === "clear"}
                  onChange={() => setScheduleVersionChoice("clear")}
                  style={{ accentColor: C.orange }}
                />
                Clear linked version
              </label>
            </div>
          </div>
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
                laborHoursDelta,
                laborCostDelta,
                materialCostDelta,
                scheduleVersionChoice,
              })
            }
            disabled={!canSave}
            variant="primary"
          >
            {saving ? "Saving..." : "Save"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
