// app/(app)/workforce/page.tsx
//
// Server component. Fetches all data, passes to client shell.
//
// PLUG IN:
//   - Replace getTenantId() with your actual tenant resolution
//     (e.g. from session, cookie, or middleware-injected header)

import {
  getPersonnel,
  getAssignmentRollup,
  getLaborRoles,
} from "@/src/lib/supabase/queries/workforce";
import { PersonnelTableShellClient } from "@/src/components/workforce/personnel-table-shell";

async function getTenantId(): Promise<string> {
  return "07055da2-1ed4-4117-956d-c49d8a133668";
}

export default async function WorkforcePage() {
  const tenantId = await getTenantId();

  const [personnel, rollups, laborRoles] = await Promise.all([
    getPersonnel(tenantId),
    getAssignmentRollup(tenantId),
    getLaborRoles(tenantId),
  ]);

  console.log("TENANT ID:", tenantId);
  console.log("PERSONNEL:", personnel);

  return (
    <div
      style={{
        padding: "24px",
        background: "#0d0d0d",
        minHeight: "100vh",
        color: "#e5e5e5",
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
        Workforce
      </h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 24 }}>
        {personnel.length} personnel &mdash;{" "}
        {personnel.filter((p) => p.active).length} active
      </p>

      <PersonnelTableShellClient
        tenantId={tenantId}
        personnel={personnel}
        rollups={rollups}
        laborRoles={laborRoles}
      />
    </div>
  );
}
