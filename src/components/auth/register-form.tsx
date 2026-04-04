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
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="name" className="block text-sm text-rpg-gold mb-1">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-rpg-bg-secondary border border-rpg-border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rpg-gold transition"
        />
      </div>
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
          Password (min 6 chars)
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
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
        {loading ? "Creating account..." : "Create Account"}
      </button>
    </form>
  );
}
