import Link from "next/link";
import { HeroTree } from "@/components/landing/hero-tree";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="h-14 border-b border-rpg-border bg-rpg-bg-secondary/50 backdrop-blur flex items-center justify-between px-6">
        <span className="text-lg font-bold text-rpg-gold">SkillTree</span>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-slate-300 hover:text-white transition">Sign In</Link>
          <Link href="/register" className="text-sm bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-lg px-4 py-1.5 hover:bg-rpg-gold/30 transition">Get Started</Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <h1 className="text-5xl md:text-6xl font-bold text-center mb-4">
          <span className="text-white">Build </span>
          <span className="text-rpg-gold">Skill Trees</span>
          <span className="text-white"> Like a Game</span>
        </h1>
        <p className="text-lg text-slate-400 text-center max-w-xl mb-12">
          Create beautiful, interactive skill trees for any topic. AI generates the structure, you customize every detail. Track progress. Share with anyone.
        </p>

        <HeroTree />

        <div className="mt-12 flex gap-4">
          <Link href="/register" className="bg-rpg-gold/20 border border-rpg-gold text-rpg-gold rounded-xl px-8 py-3 text-lg font-medium hover:bg-rpg-gold/30 transition">Start Building</Link>
          <Link href="/login" className="bg-rpg-card border border-rpg-border text-slate-300 rounded-xl px-8 py-3 text-lg hover:border-rpg-neon transition">Sign In</Link>
        </div>
      </main>

      <footer className="h-12 border-t border-rpg-border flex items-center justify-center">
        <span className="text-xs text-slate-500">Machinity</span>
      </footer>
    </div>
  );
}
