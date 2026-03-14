"use client";

import Link from "next/link";

const SECTIONS = [
  { id: "what-its-for", label: "What this app is for" },
  { id: "workflow", label: "Recommended workflow" },
  { id: "page-guide", label: "Page-by-page guide" },
  { id: "status-definitions", label: "Status definitions" },
  { id: "common-tasks", label: "Common tasks" },
  { id: "scope-note", label: "V0.5 scope" },
] as const;

export default function HelpPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <header className="pi-page-header" style={{ marginBottom: 4 }}>
        <h1 className="pi-page-title" style={{ fontSize: 24, marginBottom: 6 }}>
          Help & How To
        </h1>
        <p className="pi-page-desc">
          Use this guide to understand the workflow, page purposes, and common
          tasks in Peak Installation.
        </p>
        <p
          style={{
            fontSize: 11,
            color: "var(--faint)",
            marginTop: 8,
            marginBottom: 0,
          }}
        >
          Last updated for V0.5
        </p>
      </header>

      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--bg)",
          padding: "12px 0 16px",
          marginBottom: 8,
          borderBottom: "1px solid var(--border-faint)",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {SECTIONS.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            style={{
              padding: "8px 14px",
              borderRadius: "var(--r-xs)",
              border: "1px solid var(--border)",
              background: "rgba(0,0,0,0.2)",
              color: "var(--text)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(0,0,0,0.2)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Section B: What this app is for */}
      <section
        id="what-its-for"
        className="pi-card-lift"
        style={{ overflow: "hidden", scrollMarginTop: 80 }}
      >
        <h2 className="pi-section-title" style={{ marginBottom: 16 }}>
          What this app is for
        </h2>
        <p style={{ margin: "0 0 12px 0", fontSize: 14, lineHeight: 1.6 }}>
          Peak Installation supports operational planning and financial visibility
          for installation projects. It covers:
        </p>
        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            fontSize: 14,
            lineHeight: 1.7,
            color: "var(--text)",
          }}
        >
          <li>
            <strong>Schedule versioning</strong> — Each project has schedule
            versions. One version is marked current; you maintain labor plans
            there.
          </li>
          <li>
            <strong>Weekly labor planning</strong> — Per-role headcount and
            hours (ST/OT) by week, tied to the current schedule version.
          </li>
          <li>
            <strong>Capacity forecasting</strong> — Demand vs. available
            hours/headcount by role and week. Surfaces shortages.
          </li>
          <li>
            <strong>Financial exposures</strong> — Log cost impacts (labor,
            material) from scope changes, delays, or other causes.
          </li>
          <li>
            <strong>Change orders</strong> — Convert exposures into formal change
            orders and track status through approval and billing.
          </li>
          <li>
            <strong>Reporting</strong> — Capacity shortage, exposure financial,
            and project labor demand reports. Export to CSV for meetings.
          </li>
        </ul>
      </section>

      {/* Section C: Recommended workflow */}
      <section
        id="workflow"
        className="pi-card-lift"
        style={{ overflow: "hidden", scrollMarginTop: 80 }}
      >
        <h2 className="pi-section-title" style={{ marginBottom: 16 }}>
          Recommended workflow
        </h2>
        <ol
          style={{
            margin: 0,
            paddingLeft: 20,
            fontSize: 14,
            lineHeight: 1.8,
            color: "var(--text)",
          }}
        >
          <li>Review projects on the Projects page.</li>
          <li>Open a project to see its schedule versions and labor plan.</li>
          <li>Maintain the current schedule version (add/edit labor weeks).</li>
          <li>Review the weekly labor plan for accuracy.</li>
          <li>Check the capacity forecast for shortages (Dashboard or Reports).</li>
          <li>Create or update financial exposures when cost impacts occur.</li>
          <li>Convert exposures to change orders when recovery is needed.</li>
          <li>Use reports for planning and communication; export to CSV as needed.</li>
        </ol>
      </section>

      {/* Section D: Page-by-page guide */}
      <section
        id="page-guide"
        className="pi-card-lift"
        style={{ overflow: "hidden", scrollMarginTop: 80 }}
      >
        <h2 className="pi-section-title" style={{ marginBottom: 16 }}>
          Page-by-page guide
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              padding: 16,
              background: "rgba(0,0,0,0.2)",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border-faint)",
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px 0" }}>
              <Link href="/dashboard" style={{ color: "var(--brand)", textDecoration: "none" }}>
                Dashboard
              </Link>
            </h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text)" }}>
              At-a-glance view of risk and recovery. Shows KPIs (active projects,
              exposures, capacity issues, material cost exposure), recovery
              metrics (exposures with/without CO, approved/billed CO value), and
              linked recovery items. Use it to spot shortages and track recovery
              progress.
            </p>
          </div>

          <div
            style={{
              padding: 16,
              background: "rgba(0,0,0,0.2)",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border-faint)",
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px 0" }}>
              <Link href="/projects" style={{ color: "var(--brand)", textDecoration: "none" }}>
                Projects
              </Link>
            </h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text)" }}>
              List of active projects with filters. Open a project to manage
              schedule versions and weekly labor. Create new schedule versions
              when you need a fresh baseline; set one as current for planning.
            </p>
          </div>

          <div
            style={{
              padding: 16,
              background: "rgba(0,0,0,0.2)",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border-faint)",
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px 0" }}>
              <Link href="/exposures" style={{ color: "var(--brand)", textDecoration: "none" }}>
                Exposures
              </Link>
            </h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text)" }}>
              Log and track financial exposures (labor and material cost deltas)
              by project. Link exposures to change orders when you pursue
              recovery. Filter by status (open, pending, closed).
            </p>
          </div>

          <div
            style={{
              padding: 16,
              background: "rgba(0,0,0,0.2)",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border-faint)",
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px 0" }}>
              <Link href="/change-orders" style={{ color: "var(--brand)", textDecoration: "none" }}>
                Change Orders
              </Link>
            </h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text)" }}>
              Create and manage change orders. Link them to exposures for
              traceability. Track status from draft through submitted, approved,
              and billed. Use for commercial recovery tracking.
            </p>
          </div>

          <div
            style={{
              padding: 16,
              background: "rgba(0,0,0,0.2)",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--border-faint)",
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px 0" }}>
              <Link href="/reports" style={{ color: "var(--brand)", textDecoration: "none" }}>
                Reports
              </Link>
            </h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text)" }}>
              Capacity shortage, exposure financial, and project labor demand
              reports. Use for planning meetings and stakeholder communication.
              Export any section to CSV.
            </p>
          </div>
        </div>
      </section>

      {/* Section E: Status definitions */}
      <section
        id="status-definitions"
        className="pi-card-lift"
        style={{ overflow: "hidden", scrollMarginTop: 80 }}
      >
        <h2 className="pi-section-title" style={{ marginBottom: 16 }}>
          Status definitions
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px 0", color: "var(--muted)" }}>
              Exposure statuses
            </h3>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
              <li><strong>open</strong> — Active; needs attention or recovery.</li>
              <li><strong>pending</strong> — In progress (e.g., change order in flight).</li>
              <li><strong>closed</strong> — Resolved or no longer relevant.</li>
            </ul>
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px 0", color: "var(--muted)" }}>
              Change order statuses
            </h3>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
              <li><strong>draft</strong> — Being prepared; not yet submitted.</li>
              <li><strong>submitted</strong> — Sent for approval.</li>
              <li><strong>approved</strong> — Approved; awaiting billing.</li>
              <li><strong>billed</strong> — Billed; recovery complete.</li>
              <li><strong>cancelled</strong> — No longer pursued.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Section F: Common tasks */}
      <section
        id="common-tasks"
        className="pi-card-lift"
        style={{ overflow: "hidden", scrollMarginTop: 80 }}
      >
        <h2 className="pi-section-title" style={{ marginBottom: 16 }}>
          Common tasks
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px 0" }}>
              Creating a new schedule version
            </h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
              Go to Projects → open a project → Schedule Versions. Click
              &quot;Create New Version&quot;. Enter a revision reason. Optionally
              mark as client-driven to auto-create an exposure. Set it as current
              when you want to plan against it.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px 0" }}>
              Logging a financial exposure
            </h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
              Go to Projects → open a project → Exposures section → Create
              Exposure. Enter title, cause type, and estimated labor/material
              cost deltas. Save. Status defaults to open.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px 0" }}>
              Creating a change order from an exposure
            </h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
              Go to Change Orders → Create change order. Select the exposure to
              link, enter CO number and amount. Save as draft, then submit when
              ready. The exposure will show the linked CO.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px 0" }}>
              Exporting a report to CSV
            </h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
              Go to Reports. Each section (Capacity Shortage, Exposure
              Financial, Project Labor) has an &quot;Export CSV&quot; button.
              Click it to download the current data with today&apos;s date in the
              filename.
            </p>
          </div>
        </div>
      </section>

      {/* Section G: V0.5 scope note */}
      <section
        id="scope-note"
        className="pi-card-lift"
        style={{ overflow: "hidden", scrollMarginTop: 80 }}
      >
        <h2 className="pi-section-title" style={{ marginBottom: 16 }}>
          V0.5 scope note
        </h2>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>
          This app is focused on operational planning and financial visibility.
          It is not a full ERP. It does not yet include full billing automation
          or advanced scheduling UI. Use it to track risk, exposures, and
          change orders; integrate with other systems for invoicing and detailed
          scheduling as needed.
        </p>
      </section>
    </div>
  );
}
