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
    <div style={{ display: "grid", gap: 24 }}>
      <header className="pi-page-header">
        <h1 className="pi-page-title">Projects</h1>
        <p className="pi-page-desc">Create and manage projects. Tenant-scoped by RLS.</p>
      </header>

      <form onSubmit={createProject} className="pi-card" style={{ maxWidth: 720 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div className="pi-form-group">
            <label>Project # *</label>
            <input
              className="pi-input"
              value={projectNumber}
              onChange={(e) => setProjectNumber(e.target.value)}
              placeholder="P-1002"
            />
          </div>
          <div className="pi-form-group">
            <label>Name *</label>
            <input
              className="pi-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New Conveyor Install"
            />
          </div>
          <div className="pi-form-group">
            <label>Client</label>
            <input
              className="pi-input"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Amazon / FedEx / etc."
            />
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="submit" className="pi-btn">
              Create Project
            </button>
            {error ? <span style={{ color: "var(--bad)" }}>{error}</span> : null}
          </div>
        </div>
      </form>

      <div className="pi-card-lift">
        <h2 className="pi-section-title">Current Projects</h2>
        {loading ? (
          <p className="pi-page-desc">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="pi-empty">
            <div className="pi-empty-title">No projects yet</div>
            <span>Create a project above to get started.</span>
          </div>
        ) : (
          <div className="pi-table-wrap">
            <table className="pi-table">
              <thead>
                <tr>
                  <th>Project #</th>
                  <th>Name</th>
                  <th>Client</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`/projects/${p.id}`}
                        style={{ fontWeight: 600, color: "var(--text)", textDecoration: "none" }}
                      >
                        {p.project_number}
                      </Link>
                    </td>
                    <td>
                      <Link
                        href={`/projects/${p.id}`}
                        style={{ color: "var(--text)", textDecoration: "none" }}
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td>{p.client_name ?? "—"}</td>
                    <td>
                      <span className="pi-badge" style={{ textTransform: "capitalize" }}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
