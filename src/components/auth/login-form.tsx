"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/dashboard");
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
        <label htmlFor="email" className="block text-sm text-rpg-gold mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
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
