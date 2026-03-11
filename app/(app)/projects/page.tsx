"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Project = {
  id: string;
  tenant_id: string;
  project_number: string;
  name: string;
  client_name: string | null;
  status: string;
  location: string | null;
  created_at?: string;
};

export default function ProjectsPage() {
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [projectNumber, setProjectNumber] = useState("");
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");

  async function loadProjects() {
    setError(null);

    const { data, error } = await supabase
      .from("projects")
      .select(
        "id, tenant_id, project_number, name, client_name, status, location, created_at",
      )
      .order("project_number", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setProjects((data ?? []) as Project[]);
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const pn = projectNumber.trim();
    const nm = name.trim();

    if (!pn || !nm) {
      setError("Project # and Name are required.");
      return;
    }

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      setError("You are not signed in.");
      return;
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profErr) {
      setError(`Could not load profile/tenant: ${profErr.message}`);
      return;
    }

    const { error: insErr } = await supabase.from("projects").insert({
      tenant_id: profile.tenant_id,
      project_number: pn,
      name: nm,
      client_name: clientName.trim() || null,
      status: "active",
    });

    if (insErr) {
      setError(insErr.message);
      return;
    }

    setProjectNumber("");
    setName("");
    setClientName("");

    await loadProjects();
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadProjects();
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Projects</h1>
        <p style={{ opacity: 0.8, marginTop: 6 }}>
          Minimal list + create. Tenant-scoped by RLS.
        </p>
      </div>

      <form
        onSubmit={createProject}
        style={{
          display: "grid",
          gap: 10,
          padding: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
          maxWidth: 720,
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontWeight: 600 }}>Project # *</label>
          <input
            value={projectNumber}
            onChange={(e) => setProjectNumber(e.target.value)}
            placeholder="P-1002"
            style={{ padding: 10, borderRadius: 10 }}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontWeight: 600 }}>Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New Conveyor Install"
            style={{ padding: 10, borderRadius: 10 }}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontWeight: 600 }}>Client</label>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Amazon / FedEx / etc."
            style={{ padding: 10, borderRadius: 10 }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Create Project
          </button>

          {error ? <span style={{ color: "#fca5a5" }}>{error}</span> : null}
        </div>
      </form>

      <div
        style={{
          padding: 16,
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>
          Current Projects
        </h2>

        {loading ? (
          <div>Loading…</div>
        ) : projects.length === 0 ? (
          <div style={{ opacity: 0.8 }}>No projects yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr 120px",
                  gap: 12,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.10)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ fontWeight: 700 }}>{p.project_number}</div>

                <div>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div style={{ opacity: 0.75, fontSize: 13 }}>
                    {p.client_name ?? "—"}
                  </div>
                </div>

                <div style={{ textTransform: "capitalize", opacity: 0.9 }}>
                  {p.status}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
