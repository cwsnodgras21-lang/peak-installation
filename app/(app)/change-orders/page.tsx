export default function ChangeOrdersPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <header className="pi-page-header" style={{ marginBottom: 4 }}>
        <h1 className="pi-page-title" style={{ fontSize: 24, marginBottom: 6 }}>
          Change Orders
        </h1>
        <p className="pi-page-desc">
          Track submitted and approved change orders, connect them to exposures,
          and monitor billing status.
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
          Coming in next version
        </h2>
        <p
          style={{
            margin: "0 0 20px 0",
            color: "var(--text)",
            lineHeight: 1.6,
            fontSize: 14,
          }}
        >
          Change Orders will manage scope changes, client requests, and their
          impact on schedule and cost. You&apos;ll be able to submit, approve,
          and track change orders in one place.
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
          <li>Track submitted and approved change orders</li>
          <li>Connect change orders to financial exposures</li>
          <li>Monitor billing status</li>
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
          <strong style={{ color: "var(--text)" }}>V0.5 note:</strong> Schedule
          revisions and exposures are the current source of truth. Use the
          Exposures page to track financial impact from client-driven revisions
          until Change Orders are available.
        </p>
      </section>
    </div>
  );
}
