import type { Metadata } from "next";
import { Cinzel, Source_Sans_3, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel", weight: ["400", "700", "900"] });
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "SkillTree — Goal-first roadmap builder",
  description: "Turn any goal into a clear roadmap of steps, requirements, and progress with an interactive visual planner.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${sourceSans.variable} ${jetbrains.variable}`}>
      <body className="bg-rpg-bg min-h-screen antialiased font-[family-name:var(--font-source)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
