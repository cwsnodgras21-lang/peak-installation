import { supabase } from "@/lib/supabaseClient";

export type LaborRole = {
  id: string;
  name: string;
};

export type Personnel = {
  id: string;
  tenant_id: string;
  full_name: string;
  labor_role_id: string | null;
  active: boolean;
  labor_roles: { id: string; name: string } | null;
};

export type AssignmentRollup = {
  person_id: string;
  current_project_name: string | null;
  current_task_name: string | null;
};

export type PersonWeekAssignment = {
  person_id: string;
  week_start_date: string;
  project_name: string | null;
  schedule_task_name: string | null;
};

export async function getPersonnel(tenantId: string): Promise<Personnel[]> {
  const { data, error } = await supabase
    .from("personnel")
    .select(
      `
      id,
      tenant_id,
      full_name,
      labor_role_id,
      active,
      labor_roles ( id, name )
    `,
    )
    .eq("tenant_id", tenantId)
    .order("full_name");

  if (error) {
    console.error("[getPersonnel]", error);
    throw error;
  }

  return (data ?? []) as Personnel[];
}

export async function getLaborRoles(tenantId: string): Promise<LaborRole[]> {
  const { data, error } = await supabase
    .from("labor_roles")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name");

  if (error) {
    console.error("[getLaborRoles]", error);
    throw error;
  }

  return (data ?? []) as LaborRole[];
}

export async function getAssignmentRollup(
  tenantId: string,
): Promise<AssignmentRollup[]> {
  const { data, error } = await supabase
    .from("v_person_person_week")
    .select("person_id, project_name, schedule_task_name")
    .eq("tenant_id", tenantId)
    .eq("week_start_date", "2026-03-16");

  if (error) {
    console.error("[getAssignmentRollup]", error);
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    person_id: row.person_id,
    current_project_name: row.project_name,
    current_task_name: row.schedule_task_name,
  })) as AssignmentRollup[];
}

export async function getPersonWeekAssignments(
  tenantId: string,
  personId: string,
): Promise<PersonWeekAssignment[]> {
  const { data, error } = await supabase
    .from("v_person_person_week")
    .select("person_id, week_start_date, project_name, schedule_task_name")
    .eq("tenant_id", tenantId)
    .eq("person_id", personId)
    .order("week_start_date", { ascending: true })
    .limit(12);

  if (error) {
    console.error("[getPersonWeekAssignments]", error);
    throw error;
  }

  return (data ?? []) as PersonWeekAssignment[];
}
