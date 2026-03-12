"use client";

// components/workforce/personnel-table.tsx

import { useState } from "react";
import type {
  PersonnelWithRole,
  AssignmentRollup,
  LaborRole,
} from "@/lib/types/workforce";

type Props = {
  personnel: PersonnelWithRole[];
  rollups: AssignmentRollup[];
  laborRoles: LaborRole[];
  onSelectPerson: (id: string) => void;
};

export function PersonnelTable({
  personnel,
  rollups,
  laborRoles,
  onSelectPerson,
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
    <div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
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

        <span style={{ color: "#666", fontSize: 12 }}>
          {visible.length} / {personnel.length}
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
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
                  style={{ padding: 16, color: "#555", textAlign: "center" }}
                >
                  No results.
                </td>
              </tr>
            )}
            {visible.map((p) => {
              const rollup = rollupById[p.id];
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #1e1e1e" }}>
                  <td style={td}>
                    <button
                      onClick={() => onSelectPerson(p.id)}
                      style={nameBtn}
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

const sel: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #333",
  color: "#ccc",
  padding: "5px 8px",
  borderRadius: 4,
  fontSize: 13,
};
const th: React.CSSProperties = {
  padding: "8px 12px",
  color: "#888",
  fontWeight: 600,
  borderBottom: "1px solid #2a2a2a",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "7px 12px",
  color: "#ddd",
  verticalAlign: "middle",
};
const nameBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#f97316",
  cursor: "pointer",
  fontSize: 13,
  padding: 0,
  textDecoration: "underline",
};
const activeBadge: React.CSSProperties = {
  background: "#14532d",
  color: "#86efac",
  padding: "1px 7px",
  borderRadius: 3,
  fontSize: 11,
};
const inactiveBadge: React.CSSProperties = {
  background: "#27272a",
  color: "#71717a",
  padding: "1px 7px",
  borderRadius: 3,
  fontSize: 11,
};
