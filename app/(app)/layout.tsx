"use client";

// Shared app shell: sidebar + main. All (app) routes get this layout.
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const tenantName = "Peak Installation"; // later make this dynamic
  const pathname = usePathname();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#0b0b0f,#14141c)",
        color: "var(--text)",
        fontFamily:
          "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr" }}>
        <aside
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            borderRight: "1px solid var(--border)",
            background: "var(--bg-subtle)",
            padding: "20px 16px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Brand / tenant */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              paddingBottom: 20,
              borderBottom: "1px solid var(--border-faint)",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--border)",
                background: "var(--panel)",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <Image
                src="/nolturn-mark.png"
                alt=""
                width={24}
                height={24}
                priority
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: "var(--text)",
                }}
              >
                {tenantName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  letterSpacing: "0.03em",
                }}
              >
                Operations
              </div>
            </div>
          </div>

          <nav style={{ flex: 1 }}>
            <NavItem
              href="/dashboard"
              label="Dashboard"
              active={pathname === "/dashboard"}
            />
            <NavItem
              href="/projects"
              label="Projects"
              active={
                pathname === "/projects" || pathname?.startsWith("/projects/")
              }
            />
            <NavItem
              href="/exposures"
              label="Exposures"
              active={pathname === "/exposures"}
            />
            <NavItem
              href="/change-orders"
              label="Change Orders"
              active={pathname === "/change-orders"}
            />
            <NavItem
              href="/reports"
              label="Reports"
              active={pathname === "/reports"}
            />
            <NavItem
              href="/help"
              label="Help"
              active={pathname === "/help"}
            />
          </nav>

          <div
            style={{
              marginTop: "auto",
              paddingTop: 16,
              borderTop: "1px solid var(--border-faint)",
              fontSize: 11,
              color: "var(--faint)",
            }}
          >
            {tenantName} · V0.5
          </div>
        </aside>

        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <header
            style={{
              position: "sticky",
              top: 0,
              zIndex: 5,
              flexShrink: 0,
              borderBottom: "1px solid var(--border)",
              background: "rgba(11,11,15,0.9)",
              backdropFilter: "blur(12px)",
              padding: "16px 24px",
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
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: "var(--text)",
                  letterSpacing: "-0.01em",
                }}
              >
                {tenantName}
              </span>
            </div>
          </header>

          <main
            style={{
              flex: 1,
              padding: 24,
              overflow: "auto",
            }}
          >
            <div className="pi-page">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

function NavItem({
  href,
  label,
  active = false,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className="app-nav-item"
      data-active={active}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: "var(--r-sm)",
        border: "1px solid transparent",
        color: active ? "var(--text)" : "var(--muted)",
        textDecoration: "none",
        marginBottom: 4,
        background: active
          ? "rgba(255,140,0,0.1)"
          : "transparent",
        borderColor: active ? "rgba(255,140,0,0.25)" : "transparent",
        fontWeight: active ? 600 : 500,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: active ? "var(--brand)" : "var(--faint)",
          flexShrink: 0,
        }}
      />
      <span>{label}</span>
    </Link>
  );
}
