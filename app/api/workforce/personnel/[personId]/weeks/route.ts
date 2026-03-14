import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(
  _req: Request,
  { params }: { params: { personId: string } },
) {
  const personId = params.personId;

  const { searchParams } = new URL(_req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json(
      { error: "tenantId is required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("v_person_person_week")
    .select("person_id, week_start_date, project_name, schedule_task_name")
    .eq("tenant_id", tenantId)
    .eq("person_id", personId)
    .order("week_start_date", { ascending: true })
    .limit(12);

  if (error) {
    console.error("[GET person weeks]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
