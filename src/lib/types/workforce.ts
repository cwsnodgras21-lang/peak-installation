export type LaborRole = {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
};

export type Personnel = {
  id: string;
  tenant_id: string;
  full_name: string;
  labor_role_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type PersonnelWithRole = Personnel & {
  labor_roles: Pick<LaborRole, "id" | "name"> | null;
};

export type AssignmentRollup = {
  tenant_id: string;
  person_id: string;
  full_name: string;
  labor_role_name: string | null;
  current_project_name: string | null;
  current_task_name: string | null;
  active_weeks: number;
  first_assignment: string | null;
  last_assignment: string | null;
};

export type PersonWeekAssignment = {
  person_id: string;
  week_start_date: string;
  project_name: string | null;
  schedule_task_name: string | null;
};
