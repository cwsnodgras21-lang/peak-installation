"use client";

export default function PricingPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 800 }}>
      <h1 style={{ fontSize: 32, fontWeight: 700 }}>Pricing</h1>

      <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
        <div style={{ border: "1px solid #ccc", padding: 16, borderRadius: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Free</h2>
          <p style={{ marginTop: 8 }}>Up to 5 items</p>
        </div>

        <div style={{ border: "2px solid black", padding: 16, borderRadius: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Pro</h2>
          <p style={{ marginTop: 8 }}>Unlimited items</p>
          <button
            style={{
              marginTop: 12,
              padding: "10px 16px",
              borderRadius: 8,
              background: "black",
              color: "white",
              fontWeight: 600,
            }}
            onClick={() => alert("Stripe comes next 😉")}
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    </main>
  );
}