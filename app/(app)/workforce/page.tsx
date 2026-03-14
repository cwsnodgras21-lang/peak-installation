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
    <div>
      <header className="pi-page-header">
        <h1 className="pi-page-title">Workforce</h1>
        <p className="pi-page-desc">
          {personnel.length} personnel &mdash; {personnel.filter((p) => p.active).length} active
        </p>
      </header>

      <PersonnelTableShellClient
        tenantId={tenantId}
        personnel={personnel}
        rollups={rollups}
        laborRoles={laborRoles}
      />
    </div>
  );
}
