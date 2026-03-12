import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: Request) {
  const { tenantId, payload } = await req.json();

  const { data, error } = await supabase
    .from("personnel")
    .insert({
      tenant_id: tenantId,
      full_name: payload.full_name,
      employee_code: payload.employee_code,
      labor_role_id: payload.labor_role_id,
      active: payload.active,
      skill_level: payload.skill_level,
      travel_ready: payload.travel_ready,
      home_location: payload.home_location,
      notes: payload.notes,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const { personId, payload } = await req.json();

  const { data, error } = await supabase
    .from("personnel")
    .update(payload)
    .eq("id", personId)
    .select()
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
