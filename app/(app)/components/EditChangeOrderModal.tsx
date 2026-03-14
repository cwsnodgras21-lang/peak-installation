"use client";

import { useState, useEffect } from "react";

export type ChangeOrderForEdit = {
  id: string;
  project_id: string;
  financial_exposure_id: string | null;
  co_number: string;
  title: string;
  amount: number;
};

export type ExposureRef = {
  id: string;
  project_id: string;
  title: string | null;
};

const C = {
  orange: "#fb923c",
  primary: "#f1f5f9",
  muted: "#94a3b8",
  faint: "#475569",
  border: "rgba(255,255,255,0.08)",
  surface: "rgba(255,255,255,0.025)",
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

export function EditChangeOrderModal({
  changeOrder,
  exposures,
  exposureTitles,
  saving,
  error,
  onSave,
  onCancel,
}: {
  changeOrder: ChangeOrderForEdit;
  exposures: ExposureRef[];
  exposureTitles: Record<string, string>;
  saving: boolean;
  error: string | null;
  onSave: (draft: {
    co_number: string;
    title: string;
    financial_exposure_id: string | null;
    amount: string;
  }) => void;
  onCancel: () => void;
}) {
  const [coNumber, setCoNumber] = useState(changeOrder.co_number);
  const [title, setTitle] = useState(changeOrder.title);
  const [exposureId, setExposureId] = useState(
    changeOrder.financial_exposure_id ?? "",
  );
  const [amount, setAmount] = useState(String(changeOrder.amount ?? 0));

  useEffect(() => {
    setCoNumber(changeOrder.co_number);
    setTitle(changeOrder.title);
    setExposureId(changeOrder.financial_exposure_id ?? "");
    setAmount(String(changeOrder.amount ?? 0));
  }, [changeOrder]);

  const exposuresForProject = exposures.filter(
    (e) => e.project_id === changeOrder.project_id,
  );

  function validate(): string | null {
    if (!coNumber.trim()) return "CO Number is required.";
    if (!title.trim()) return "Title is required.";
    const amt = Number(amount);
    if (isNaN(amt) || amt < 0) return "Amount must be 0 or greater.";
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
          Edit Change Order
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
              CO Number *
            </label>
            <input
              type="text"
              value={coNumber}
              onChange={(e) => setCoNumber(e.target.value)}
              placeholder="e.g. CO-001"
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
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Additional scope for Phase 2"
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
              Linked Exposure
            </label>
            <select
              value={exposureId}
              onChange={(e) => setExposureId(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="">— None —</option>
              {exposuresForProject.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title ?? exposureTitles[e.id] ?? e.id.slice(0, 8)}
                </option>
              ))}
              {changeOrder.financial_exposure_id &&
                !exposuresForProject.some(
                  (e) => e.id === changeOrder.financial_exposure_id,
                ) && (
                  <option value={changeOrder.financial_exposure_id}>
                    {exposureTitles[changeOrder.financial_exposure_id] ??
                      changeOrder.financial_exposure_id.slice(0, 8)}{" "}
                    (no longer available)
                  </option>
                )}
            </select>
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
              Amount *
            </label>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={inputStyle}
            />
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
                co_number: coNumber.trim(),
                title: title.trim(),
                financial_exposure_id: exposureId || null,
                amount,
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
