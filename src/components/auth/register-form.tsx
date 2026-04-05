"use client";

import { useState } from "react";

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name || !email || !password) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Registration failed");
      setLoading(false);
      return;
    }

    try {
      const csrfRes = await fetch("/api/auth/csrf");
      const { csrfToken } = await csrfRes.json();

      await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email, password, csrfToken }),
        credentials: "include",
      });

      window.location.href = "/dashboard";
    } catch {
      window.location.href = "/login";
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 w-full max-w-sm">
      {error && (
        <div className="border border-poe-danger/30 rounded-md p-3 text-poe-danger text-sm bg-poe-danger/5">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="name" className="block text-[10px] text-poe-text-dim mb-1.5 uppercase tracking-wider font-mono">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="poe-input w-full px-4 py-3 text-sm"
        />
      </div>
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
          Password <span className="text-poe-text-dim">(min 6 chars)</span>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
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
        {loading ? "Forging identity..." : "Begin"}
      </button>
    </form>
  );
}
