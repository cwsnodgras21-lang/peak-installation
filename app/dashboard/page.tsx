"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

type ForecastRow = {
  week_start_date: string;
  required_hours: number;
  available_hours: number;
  gap_hours: number;
  status: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [plan, setPlan] = useState<string>("free");
  const [rows, setRows] = useState<ForecastRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (!data.session) router.replace("/login");
      else {
        loadPlan();
        loadForecast();
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setLoading(false);
      if (!sess) router.replace("/login");
      else {
        loadPlan();
        loadForecast();
      }
    });

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadPlan() {
    const { data, error } = await supabase.from("profiles").select("plan").single();
    if (!error && data?.plan) setPlan(data.plan);
  }

  async function loadForecast() {
    try {
      setError(null);
      const res = await fetch("/api/tenant-forecast");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Forecast request failed");
      setRows(json.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
      setRows([]);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) return <main style={{ padding: 24 }}>Loading...</main>;
  if (!session) return null;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 900 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Atlas Capacity — Dashboard</h1>

      <p style={{ marginTop: 8 }}>
        Logged in as <b>{session.user.email}</b>
      </p>

      <p style={{ marginTop: 6 }}>
        Plan:{" "}
        <span style={{ padding: "2px 8px", border: "1px solid #ccc", borderRadius: 999 }}>
          {plan.toUpperCase()}
        </span>
        {"  "}
        <a href="/pricing" style={{ marginLeft: 10 }}>
          View pricing
        </a>
      </p>

      <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
        <button onClick={loadForecast} style={{ padding: 10, borderRadius: 8 }}>
          Refresh forecast
        </button>
        <button onClick={signOut} style={{ padding: 10, borderRadius: 8 }}>
          Sign Out
        </button>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <h2 style={{ marginBottom: 8 }}>Tenant Capacity (next 8–12 weeks)</h2>

      {error && <pre style={{ padding: 12, border: "1px solid #f00" }}>{error}</pre>}

      <pre style={{ whiteSpace: "pre-wrap" }}>
        {rows
          .map(
            (r) =>
              `${r.week_start_date} | req ${r.required_hours} | avail ${r.available_hours} | gap ${r.gap_hours} | ${r.status}`
          )
          .join("\n")}
      </pre>
    </main>
  );
}