"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

const TENANT_ID = "9761a26d-d4ed-482b-9382-fd742cd265d8";
const WEEK = "2026-03-02";

export default function WorkforcePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [availableHours, setAvailableHours] = useState<number>(0);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (!data.session) router.replace("/login");
      else loadWeek();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setLoading(false);
      if (!sess) router.replace("/login");
      else loadWeek();
    });

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadWeek() {
    setStatus("Loading...");
    const { data, error } = await supabase
      .from("workforce_weekly_availability")
      .select("available_hours")
      .eq("tenant_id", TENANT_ID)
      .eq("week_start_date", WEEK)
      .maybeSingle();

    if (error) {
      setStatus("Error loading week: " + error.message);
      return;
    }

    setAvailableHours(data?.available_hours ?? 0);
    setStatus("");
  }

  async function save() {
    setStatus("Saving...");
    const { error } = await supabase.from("workforce_weekly_availability").upsert(
      {
        tenant_id: TENANT_ID,
        week_start_date: WEEK,
        available_hours: availableHours,
        notes: "Updated from UI",
      },
      { onConflict: "tenant_id,week_start_date" }
    );

    if (error) {
      setStatus("Save failed: " + error.message);
      return;
    }

    setStatus("Saved.");
  }

  if (loading) return <main style={{ padding: 24 }}>Loading...</main>;
  if (!session) return null;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 700 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Workforce Availability</h1>

      <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
        <a href="/dashboard">← Back to dashboard</a>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <h2>Week of {WEEK}</h2>

      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <label style={{ minWidth: 140 }}>Available Hours</label>
        <input
          type="number"
          value={availableHours}
          onChange={(e) => setAvailableHours(Number(e.target.value))}
          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6, width: 140 }}
        />
        <button onClick={save} style={{ padding: "8px 12px" }}>
          Save
        </button>
      </div>

      {status && <p style={{ marginTop: 10 }}>{status}</p>}
    </main>
  );
}