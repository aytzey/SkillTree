"use client";

import { useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");

    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();

      await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email, password, csrfToken }),
        credentials: "include",
      });

      const sessionRes = await fetch("/api/auth/session", { credentials: "include" });
      const session = await sessionRes.json();

      if (session?.user) {
        window.location.href = "/dashboard";
        return;
      } else {
        setError("Invalid email or password");
      }
    } catch {
      setError("Something went wrong");
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm text-rpg-gold mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-rpg-bg-secondary border border-rpg-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rpg-gold transition"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm text-rpg-gold mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-rpg-bg-secondary border border-rpg-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rpg-gold transition"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-lg py-2 font-medium hover:bg-rpg-gold/30 transition disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
