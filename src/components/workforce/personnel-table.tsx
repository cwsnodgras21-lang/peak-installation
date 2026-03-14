"use client";

// components/workforce/personnel-table.tsx

import { useState } from "react";
import type {
  PersonnelWithRole,
  AssignmentRollup,
  LaborRole,
} from "@/src/lib/types/workforce";

type Props = {
  personnel: PersonnelWithRole[];
  rollups: AssignmentRollup[];
  laborRoles: LaborRole[];
  onSelectPerson: (id: string) => void;
  selectedPersonId?: string | null;
};

export function PersonnelTable({
  personnel,
  rollups,
  laborRoles,
  onSelectPerson,
  selectedPersonId,
}: Props) {
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const rollupById = Object.fromEntries(rollups.map((r) => [r.person_id, r]));

  const visible = personnel.filter((p) => {
    if (roleFilter && p.labor_role_id !== roleFilter) return false;
    if (activeFilter === "active" && !p.active) return false;
    if (activeFilter === "inactive" && p.active) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={sel}
        >
          <option value="">All Roles</option>
          {laborRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <select
          value={activeFilter}
          onChange={(e) =>
            setActiveFilter(e.target.value as typeof activeFilter)
          }
          style={sel}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <span style={countText}>
          {visible.length} / {personnel.length}
        </span>
      </div>

      <div style={tableWrap}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
        >
          <thead>
            <tr style={{ background: "#161616", textAlign: "left" }}>
              {[
                "Name",
                "Role",
                "Status",
                "Current Project",
                "Current Task",
              ].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: 16, color: "#666", textAlign: "center" }}
                >
                  No results.
                </td>
              </tr>
            )}

            {visible.map((p) => {
              const rollup = rollupById[p.id];
              const isSelected = selectedPersonId === p.id;

              return (
                <tr
                  key={p.id}
                  style={{
                    ...row,
                    ...(isSelected ? selectedRow : {}),
                  }}
                >
                  <td style={td}>
                    <button
                      type="button"
                      onClick={() => onSelectPerson(p.id)}
                      style={{
                        ...nameBtn,
                        ...(isSelected ? selectedNameBtn : {}),
                      }}
                    >
                      {p.full_name}
                    </button>
                  </td>
                  <td style={td}>{p.labor_roles?.name ?? "—"}</td>
                  <td style={td}>
                    <span style={p.active ? activeBadge : inactiveBadge}>
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={td}>{rollup?.current_project_name ?? "—"}</td>
                  <td style={td}>{rollup?.current_task_name ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const tableWrap: React.CSSProperties = {
  overflowX: "auto",
  border: "1px solid #1f1f1f",
  borderRadius: 12,
  background: "#0b0b0b",
};

const sel: React.CSSProperties = {
  background: "#18181b",
  border: "1px solid #2f2f2f",
  color: "#e4e4e7",
  padding: "10px 14px",
  borderRadius: 10,
  fontSize: 14,
  minWidth: 140,
};

const countText: React.CSSProperties = {
  color: "#71717a",
  fontSize: 14,
};

const th: React.CSSProperties = {
  padding: "14px 18px",
  color: "#a1a1aa",
  fontWeight: 600,
  borderBottom: "1px solid #232323",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "14px 18px",
  color: "#f4f4f5",
  verticalAlign: "middle",
};

const row: React.CSSProperties = {
  borderBottom: "1px solid #1a1a1a",
};

const selectedRow: React.CSSProperties = {
  background: "rgba(249, 115, 22, 0.10)",
};

const nameBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#f97316",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  padding: 0,
  textDecoration: "none",
};

const selectedNameBtn: React.CSSProperties = {
  color: "#fb923c",
};

const activeBadge: React.CSSProperties = {
  background: "#14532d",
  color: "#86efac",
  padding: "3px 9px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
};

const inactiveBadge: React.CSSProperties = {
  background: "#27272a",
  color: "#a1a1aa",
  padding: "3px 9px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
};
