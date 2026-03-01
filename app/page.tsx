"use client";

import { useEffect, useState } from "react";

type Row = {
  week_start_date: string;
  required_hours: number;
  available_hours: number;
  gap_hours: number;
  status: string;
};

export default function HomePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/tenant-forecast");
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? "Request failed");
        setRows(json.data ?? []);
      } catch (e: any) {
        setError(e.message ?? "Unknown error");
      }
    }
    load();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Atlas Capacity</h1>

      {error && <pre>{error}</pre>}

      <pre style={{ whiteSpace: "pre-wrap" }}>
        {rows.map(r =>
          `${r.week_start_date} | req ${r.required_hours} | avail ${r.available_hours} | gap ${r.gap_hours} | ${r.status}`
        ).join("\n")}
      </pre>
    </div>
  );
}