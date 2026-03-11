// app/(app)/layout.tsx
import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#0b0b0f,#14141c)",
        color: "#e5e7eb",
        fontFamily:
          "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr" }}>
        {/* Sidebar */}
        <aside
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            borderRight: "1px solid #232334",
            background: "rgba(10,10,14,0.85)",
            padding: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid #2b2b3a",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                letterSpacing: 0.5,
              }}
            >
              P
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>
                Peak Installation
              </div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>V0.5 Engine</div>
            </div>
          </div>

          <NavItem href="/dashboard" label="Dashboard" />
          <NavItem href="/projects" label="Projects" />
          <NavItem href="/exposures" label="Exposures" />
          <NavItem href="/change-orders" label="Change Orders" />
          <NavItem href="/reports" label="Reports" />

          <div style={{ marginTop: 22, opacity: 0.6, fontSize: 12 }}>
            Tip: Keep V0.5 ugly-but-accurate.
          </div>
        </aside>

        {/* Main */}
        <div>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 5,
              borderBottom: "1px solid #232334",
              background: "rgba(11,11,15,0.75)",
              backdropFilter: "blur(10px)",
              padding: "14px 18px",
            }}
          >
            <div
              style={{
                maxWidth: 1180,
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 800 }}>Capacity Dashboard</div>
            </div>
          </div>

          <main style={{ padding: 18 }}>
            <div style={{ maxWidth: 1180, margin: "0 auto" }}>{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 10px",
        borderRadius: 12,
        border: "1px solid transparent",
        color: "#e5e7eb",
        textDecoration: "none",
        marginBottom: 8,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: "#ff8c00",
        }}
      />
      <span style={{ fontWeight: 650 }}>{label}</span>
    </Link>
  );
}
