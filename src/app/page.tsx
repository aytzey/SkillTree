import Link from "next/link";
import { HeroTree } from "@/components/landing/hero-tree";
import { Particles } from "@/components/landing/particles";
import {
  ROADMAP_MICROCOPY,
  ROADMAP_PRIMARY_CTA_COPY,
  ROADMAP_SECTION_LABELS,
} from "@/lib/copy-constants";

const landingBenefits = [
  {
    title: "Start with clarity",
    body: "Turn one messy goal into a roadmap with concrete next steps.",
  },
  {
    title: "See the full path",
    body: "Map dependencies, milestones, and requirements before you begin.",
  },
  {
    title: "Keep momentum",
    body: "Track progress visually so you always know what to do next.",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col bg-grain bg-grid overflow-hidden">
      <Particles />

      <nav className="sticky top-0 z-30 h-16 flex items-center justify-between px-6 md:px-8 backdrop-blur-md bg-[#0b0b18]/65 border-b border-[rgba(196,148,26,0.08)]">
        <span className="text-xl font-[family-name:var(--font-cinzel)] font-bold tracking-wide" style={{ color: "var(--gold-rich)" }}>
          SKILLTREE
        </span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm tracking-wide uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-300">
            Sign In
          </Link>
          <Link
            href="/register"
            data-testid="nav-primary-cta"
            className="text-sm tracking-widest uppercase px-5 py-2 border border-[var(--gold-rich)] text-[var(--gold-rich)] hover:bg-[var(--gold-rich)] hover:text-[var(--bg-primary)] transition-all duration-300 font-semibold"
          >
            {ROADMAP_PRIMARY_CTA_COPY.landing}
          </Link>
        </div>
      </nav>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        <div className="absolute inset-0 hero-glow pointer-events-none" />

        <div className="relative text-center mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <h1 className="font-[family-name:var(--font-cinzel)] font-bold leading-[0.95] tracking-tight">
            <span className="block text-[clamp(2.5rem,7vw,5.5rem)] text-[var(--text-primary)]">
              Set a Goal.
            </span>
            <span className="block text-[clamp(3.5rem,10vw,8rem)] text-shimmer mt-1">
              Build the Path.
            </span>
          </h1>
          <p className="mt-4 text-[10px] md:text-xs uppercase tracking-[0.45em] text-[var(--gold-rich)]/80">
            {ROADMAP_SECTION_LABELS.landingTitle}
          </p>
        </div>

        <p className="relative text-center text-[var(--text-secondary)] max-w-2xl text-base leading-relaxed mb-10 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          {ROADMAP_MICROCOPY.landingSubtitle}
          <br />
          <span className="text-sm opacity-70">Plan smarter, understand dependencies earlier, and keep moving without losing the thread.</span>
        </p>

        <div
          data-testid="benefit-row"
          className="relative grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl mb-12 animate-fade-up"
          style={{ animationDelay: "0.45s" }}
        >
          {landingBenefits.map((benefit, index) => (
            <div
              key={benefit.title}
              data-testid="benefit-item"
              className="rounded-2xl border border-[rgba(196,148,26,0.12)] bg-[rgba(12,12,28,0.72)] px-5 py-4 text-left shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(196,148,26,0.28)] text-xs font-semibold text-[var(--gold-rich)]">
                  0{index + 1}
                </span>
                <h2 className="font-[family-name:var(--font-cinzel)] text-base text-[var(--text-primary)]">
                  {benefit.title}
                </h2>
              </div>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">{benefit.body}</p>
            </div>
          ))}
        </div>

        <div className="relative animate-fade-in" style={{ animationDelay: "0.6s" }}>
          <HeroTree />
        </div>

        <div data-testid="cta-area" className="relative flex flex-col sm:flex-row gap-5 mt-14 animate-fade-up" style={{ animationDelay: "0.9s" }}>
          <Link
            href="/register"
            className="group relative px-10 py-4 font-[family-name:var(--font-cinzel)] font-bold text-lg tracking-wider uppercase overflow-hidden transition-all duration-300"
            style={{
              background: "linear-gradient(135deg, var(--gold-rich), var(--gold-bright))",
              color: "var(--bg-primary)",
              clipPath: "polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)",
            }}
          >
            <span className="relative z-10">{ROADMAP_PRIMARY_CTA_COPY.landing}</span>
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

      <footer className="relative z-10 h-12 flex items-center justify-center">
        <span className="text-xs text-[var(--text-secondary)] opacity-40 tracking-widest uppercase font-[family-name:var(--font-cinzel)]">Machinity</span>
      </footer>

      <div className="fixed inset-0 vignette pointer-events-none z-[1]" />
    </div>
  );
}
