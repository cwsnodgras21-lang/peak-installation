export default function ReportsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <header className="pi-page-header" style={{ marginBottom: 4 }}>
        <h1 className="pi-page-title" style={{ fontSize: 24, marginBottom: 6 }}>
          Reports
        </h1>
        <p className="pi-page-desc">
          Capacity, exposure, and labor performance reports. Coming in a future
          release.
        </p>
      </header>

      <section
        className="pi-card-lift"
        style={{
          borderColor: "rgba(251, 146, 60, 0.25)",
          background: "rgba(251, 146, 60, 0.04)",
        }}
      >
        <h2
          className="pi-section-title"
          style={{ color: "var(--brand)", marginBottom: 12 }}
        >
          Planned reports
        </h2>
        <p
          style={{
            margin: "0 0 20px 0",
            color: "var(--text)",
            lineHeight: 1.6,
            fontSize: 14,
          }}
        >
          Dedicated report views will provide deeper analysis and historical
          trends across capacity, exposures, and project labor.
        </p>

        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            color: "var(--text)",
            lineHeight: 1.8,
            fontSize: 14,
          }}
        >
          <li>Capacity and shortage trends</li>
          <li>Exposure and change recovery tracking</li>
          <li>Project labor performance</li>
        </ul>
      </section>

      <section
        className="pi-card"
        style={{
          borderColor: "var(--border-faint)",
          padding: "14px 18px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--muted)",
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "var(--text)" }}>V0.5 note:</strong> The
          Dashboard and Exposures pages are the current reporting surfaces. Use
          the Dashboard for capacity forecast and shortage visibility, and
          Exposures for financial impact tracking.
        </p>
      </section>
    </div>
  );
}
