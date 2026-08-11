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
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-hover": "var(--surface-hover)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        "accent-green": "var(--accent-green)",
        "accent-red": "var(--accent-red)",
        "accent-orange": "var(--accent-orange)",
        "accent-blue": "var(--accent-blue)",
        brand: "var(--brand)",
        "brand-ink": "var(--brand-ink)",
        "brand-text": "var(--brand-text)",
        "brand-soft": "var(--brand-soft)",
        "brand-faint": "var(--brand-faint)",
        "brand-line": "var(--brand-line)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        panel: "var(--shadow-panel)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      borderRadius: {
        card: "14px",      // kept: existing screens rely on it
        panel: "var(--r-panel)",
        soft: "var(--r-card)",
        pill: "var(--r-pill)",
      },
      maxWidth: {
        dashboard: "1400px",
      },
      spacing: {
        sidebar: "var(--sidebar-width)",
        "sidebar-expanded": "var(--sidebar-expanded)",
      },
    },
  },
  plugins: [],
};
export default config;
