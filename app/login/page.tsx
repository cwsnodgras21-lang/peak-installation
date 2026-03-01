"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");

  async function signUp() {
    setMsg("Working...");
    const { error } = await supabase.auth.signUp({ email, password });
    setMsg(error ? `❌ ${error.message}` : "✅ Signed up. Check your email if confirmation is enabled.");
  }

  async function signIn() {
    setMsg("Working...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMsg(error ? `❌ ${error.message}` : "✅ Signed in.");
  }

  async function signOut() {
    setMsg("Working...");
    const { error } = await supabase.auth.signOut();
    setMsg(error ? `❌ ${error.message}` : "✅ Signed out.");
  }

  return (
    <main style={{ padding: 24, maxWidth: 520, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Login</h1>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button onClick={signUp} style={{ padding: 10, borderRadius: 8 }}>
            Sign Up
          </button>
          <button onClick={signIn} style={{ padding: 10, borderRadius: 8 }}>
            Sign In
          </button>
          <button onClick={signOut} style={{ padding: 10, borderRadius: 8 }}>
            Sign Out
          </button>
        </div>

        <div style={{ marginTop: 10 }}>{msg}</div>
      </div>
    </main>
  );
}