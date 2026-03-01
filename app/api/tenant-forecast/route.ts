import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAdmin = createClient(url, serviceKey);

  const tenantId = "9761a26d-d4ed-482b-9382-fd742cd265d8";

  const { data, error } = await supabaseAdmin.rpc("get_tenant_capacity_forecast", {
    p_tenant_id: tenantId,
    p_weeks_ahead: 8,
  });

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ data });
}