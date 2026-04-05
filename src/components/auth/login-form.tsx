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
    <form onSubmit={handleSubmit} className="space-y-5 w-full max-w-sm">
      {error && (
        <div className="border border-poe-danger/30 rounded-md p-3 text-poe-danger text-sm bg-poe-danger/5">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-[10px] text-poe-text-dim mb-1.5 uppercase tracking-wider font-mono">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="poe-input w-full px-4 py-3 text-sm"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-[10px] text-poe-text-dim mb-1.5 uppercase tracking-wider font-mono">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="poe-input w-full px-4 py-3 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full poe-btn-gold poe-btn py-3 font-cinzel font-semibold tracking-wider disabled:opacity-50"
      >
        {loading ? "Entering..." : "Enter"}
      </button>
    </form>
  );
}
