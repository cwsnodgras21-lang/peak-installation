"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");

  async function signUp() {
    setMsg("Working...");
    const { error } = await supabase.auth.signUp({ email, password });

    setMsg(
      error
        ? `❌ ${error.message}`
        : "✅ Signed up. Check your email if confirmation is enabled.",
    );
  }

  async function signIn() {
    setMsg("Working...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMsg(`❌ ${error.message}`);
      return;
    }

    setMsg("✅ Signed in.");

    // redirect to dashboard
    router.push("/dashboard");
  }

  async function signOut() {
    setMsg("Working...");
    const { error } = await supabase.auth.signOut();
    setMsg(error ? `❌ ${error.message}` : "✅ Signed out.");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#0b0b0f,#14141c)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: 420,
          padding: 32,
          borderRadius: 16,
          background: "rgba(20,20,28,0.9)",
          border: "1px solid #232334",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <Image
            src="/nolturn-mark.png"
            alt="Nolturn"
            width={56}
            height={56}
            priority
          />

          <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 12 }}>
            Nolturn
          </h1>

          <div style={{ opacity: 0.7, fontSize: 13 }}>
            Operations Planning Platform
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <input
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: 12,
              borderRadius: 8,
              border: "1px solid #333",
              background: "#0f0f16",
              color: "white",
            }}
          />

          <input
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: 12,
              borderRadius: 8,
              border: "1px solid #333",
              background: "#0f0f16",
              color: "white",
            }}
          />

          <button
            onClick={signIn}
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 8,
              border: "none",
              background: "#ff8c00",
              color: "black",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Sign In
          </button>

          <button
            onClick={signUp}
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #333",
              background: "transparent",
              color: "#ccc",
              cursor: "pointer",
            }}
          >
            Sign Up
          </button>

          <button
            onClick={signOut}
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #333",
              background: "transparent",
              color: "#ccc",
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>

          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              opacity: 0.8,
              minHeight: 18,
            }}
          >
            {msg}
          </div>
        </div>
      </div>
    </main>
  );
}
