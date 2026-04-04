import Link from "next/link";
import { HeroTree } from "@/components/landing/hero-tree";
import { Particles } from "@/components/landing/particles";

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col bg-grain bg-grid overflow-hidden">
      {/* Ambient particles */}
      <Particles />

      {/* Nav */}
      <nav className="relative z-20 h-16 flex items-center justify-between px-8">
        <span className="text-xl font-[family-name:var(--font-cinzel)] font-bold tracking-wide" style={{ color: "var(--gold-rich)" }}>
          SKILLTREE
        </span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm tracking-wide uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-300">
            Sign In
          </Link>
          <Link href="/register" className="text-sm tracking-widest uppercase px-5 py-2 border border-[var(--gold-rich)] text-[var(--gold-rich)] hover:bg-[var(--gold-rich)] hover:text-[var(--bg-primary)] transition-all duration-300 font-semibold">
            Begin
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        {/* Radial glow behind tree */}
        <div className="absolute inset-0 hero-glow pointer-events-none" />

        {/* Heading */}
        <div className="relative text-center mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <h1 className="font-[family-name:var(--font-cinzel)] font-bold leading-[0.95] tracking-tight">
            <span className="block text-[clamp(2.5rem,7vw,5.5rem)] text-[var(--text-primary)]">
              Forge Your
            </span>
            <span className="block text-[clamp(3.5rem,10vw,8rem)] text-shimmer mt-1">
              Skill Tree
            </span>
          </h1>
        </div>

        {/* Subtitle */}
        <p className="relative text-center text-[var(--text-secondary)] max-w-md text-base leading-relaxed mb-14 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          AI crafts the path. You master the journey.
          <br />
          <span className="text-sm opacity-70">Build, track, and share interactive skill trees on any topic.</span>
        </p>

        {/* Demo tree */}
        <div className="relative animate-fade-in" style={{ animationDelay: "0.6s" }}>
          <HeroTree />
        </div>

        {/* CTA */}
        <div className="relative flex gap-5 mt-14 animate-fade-up" style={{ animationDelay: "0.9s" }}>
          <Link
            href="/register"
            className="group relative px-10 py-4 font-[family-name:var(--font-cinzel)] font-bold text-lg tracking-wider uppercase overflow-hidden transition-all duration-300"
            style={{
              background: "linear-gradient(135deg, var(--gold-rich), var(--gold-bright))",
              color: "var(--bg-primary)",
              clipPath: "polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)",
            }}
          >
            <span className="relative z-10">Start Building</span>
          </Link>
          <Link
            href="/login"
            className="px-10 py-4 font-[family-name:var(--font-cinzel)] text-lg tracking-wider uppercase border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--gold-rich)] hover:text-[var(--gold-rich)] transition-all duration-300"
            style={{
              clipPath: "polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)",
            }}
          >
            Sign In
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 h-12 flex items-center justify-center">
        <span className="text-xs text-[var(--text-secondary)] opacity-40 tracking-widest uppercase font-[family-name:var(--font-cinzel)]">Machinity</span>
      </footer>

      {/* Vignette overlay */}
      <div className="fixed inset-0 vignette pointer-events-none z-[1]" />
    </div>
  );
}
