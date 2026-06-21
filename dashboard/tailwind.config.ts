import type { Config } from "tailwindcss";

/**
 * LUCY 2.0 dashboard theme — echoes app/src/ui/theme/tokens.ts (premium dark + amber).
 * Keep these values in sync with the app token source of truth.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Backgrounds / surfaces (ink scale) ──
        bg: "#0C0B09",
        sheet: "#131108",
        surface: "#161310",
        "surface-alt": "#1F1A14",
        "surface-elevated": "#2A2219",

        // ── Borders ──
        border: "#2D2218",
        "border-soft": "#221B12",
        divider: "#1E1710",

        // ── Text ──
        "text-primary": "#F5EFE6",
        "text-secondary": "#C4A882",
        "text-muted": "#8A7560",
        "text-faint": "#5C4A38",
        "text-on-accent": "#1A0E03",

        // ── Accent (amber intelligence) ──
        accent: "#FF8C42",
        "accent-glow": "#FFA05C",
        "accent-deep": "#E8722A",
        "accent-soft": "#3D1D08",
        "accent-mist": "#2A1205",
        "accent-line": "#6F3515",

        // ── Status ──
        success: "#4ADE80",
        warning: "#F59E0B",
        danger: "#FB7185",
        info: "#60A5FA",
        violet: "#A78BFA",
        gold: "#F5C451",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        pill: "999px",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        display: ["34px", { lineHeight: "40px", fontWeight: "700" }],
        h1: ["28px", { lineHeight: "34px", fontWeight: "700" }],
        h2: ["22px", { lineHeight: "28px", fontWeight: "600" }],
        h3: ["18px", { lineHeight: "24px", fontWeight: "600" }],
        body: ["16px", { lineHeight: "22px" }],
        callout: ["15px", { lineHeight: "20px" }],
        footnote: ["13px", { lineHeight: "18px" }],
        caption: ["11px", { lineHeight: "14px", fontWeight: "500" }],
      },
      boxShadow: {
        e1: "0 1px 4px 0 rgba(255,140,66,0.06)",
        e2: "0 2px 8px 0 rgba(255,140,66,0.10)",
        e3: "0 4px 16px 0 rgba(255,140,66,0.15)",
        e4: "0 8px 24px 0 rgba(0,0,0,0.45)",
        glow: "0 0 12px 0 rgba(255,140,66,0.35)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "320ms",
      },
    },
  },
  plugins: [],
};

export default config;
