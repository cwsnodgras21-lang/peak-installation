import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabaseAdmin = createClient(url, serviceKey);

  const projectId = "f4502c0b-8ae7-44ce-b8cc-7d317b806762";

  const { data, error } = await supabaseAdmin.rpc("get_capacity_forecast", {
    p_project_id: projectId,
    p_weeks_ahead: 8,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ data });
}