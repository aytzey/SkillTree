import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        poe: {
          void: "#050510",
          obsidian: "#0a0a18",
          slate: "#10102a",
          panel: "#141430",
          "panel-hover": "#1a1a3a",
          "border-dim": "#1e1e40",
          "border-mid": "#2a2a55",
          "border-bright": "#3a3a70",
          "gold-dim": "#8b6914",
          "gold-mid": "#c4941a",
          "gold-bright": "#e8b828",
          "gold-shine": "#f5d060",
          "locked-dim": "#2a2a35",
          "locked-mid": "#404050",
          "available-glow": "#d4a017",
          "progress-blue": "#5b5ef0",
          "progress-purple": "#7c3aed",
          "complete-green": "#0d9668",
          "complete-bright": "#34d399",
          "text-primary": "#e8e4df",
          "text-secondary": "#8a8a9a",
          "text-dim": "#5a5a6a",
          "energy-blue": "#818cf8",
          "energy-purple": "#a78bfa",
          "danger": "#ef4444",
        },
      },
      fontFamily: {
        cinzel: ["var(--font-cinzel)", "serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "node-breathe": "node-breathe 3s ease-in-out infinite",
        "energy-flow": "energy-flow 2s linear infinite",
        "select-pulse": "select-pulse 1.5s ease-in-out infinite",
        "fade-in": "fade-in 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards",
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards",
      },
      keyframes: {
        "node-breathe": {
          "0%, 100%": { filter: "brightness(1)" },
          "50%": { filter: "brightness(1.15)" },
        },
        "energy-flow": {
          "0%": { strokeDashoffset: "24" },
          "100%": { strokeDashoffset: "0" },
        },
        "select-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px var(--select-color), 0 0 40px var(--select-color-dim)" },
          "50%": { boxShadow: "0 0 30px var(--select-color), 0 0 60px var(--select-color-dim)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "select-ring-pulse": {
          "0%, 100%": { opacity: "0.3", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.02)" },
        },
        "completed-shimmer": {
          "0%": { backgroundPosition: "200% 200%" },
          "50%": { backgroundPosition: "0% 0%" },
          "100%": { backgroundPosition: "200% 200%" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
