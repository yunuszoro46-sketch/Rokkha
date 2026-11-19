import type { Config } from "tailwindcss";

// Token colours accept opacity modifiers (bg-rk-brand/10) through color-mix.
const tok = (name: string) => ({ opacityValue }: { opacityValue?: string }) =>
  opacityValue === undefined || opacityValue === "1"
    ? `var(--rk-${name})`
    : `color-mix(in srgb, var(--rk-${name}) calc(${opacityValue} * 100%), transparent)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Rokkha design system tokens (design-system/rokkha/MASTER.md). New code uses rk-* only.
        rk: {
          ink: tok("ink") as any,
          forest: tok("forest") as any,
          sand: tok("sand") as any,
          mist: tok("mist") as any,
          moss: tok("moss") as any,
          clay: tok("clay") as any,
          "clay-text": tok("clay-text") as any,
          river: tok("river") as any,
          "river-text": tok("river-text") as any,
          "risk-low": tok("risk-low") as any,
          "risk-watch": tok("risk-watch") as any,
          "risk-alert": tok("risk-alert") as any,
          "risk-unknown": tok("risk-unknown") as any,
          muted: tok("muted") as any,
          page: tok("page") as any,
          secondary: tok("secondary") as any,
          surface: tok("surface") as any,
          line: tok("line") as any,
          brand: tok("brand") as any,
          "brand-strong": tok("brand-strong") as any,
          "brand-soft": tok("brand-soft") as any,
          danger: tok("danger") as any,
          "danger-soft": tok("danger-soft") as any,
          "danger-accent": tok("danger-accent") as any,
          "warning-accent": tok("warning-accent") as any,
          warning: tok("warning") as any,
          "warning-soft": tok("warning-soft") as any,
          success: tok("success") as any,
          "success-soft": tok("success-soft") as any,
          info: tok("info") as any,
          "info-soft": tok("info-soft") as any,
        },
        brand: {
          white: "#FFFFFF",
          warm: "#FAFAF7",
          forest: "#263B32",
          "forest-dark": "#1b2b24",
          "forest-light": "#324d41",
          limestone: "#EDEBE2",
          "limestone-dark": "#dedad0",
          sage: "#78958A",
          "sage-light": "#96b0a6",
          amber: "#C69A50",
          "amber-light": "#dfb672",
          clay: "#B94A48",
          "clay-light": "#d46b69",
          slate: "#64748B",
          gray: "#94A3B8",
        },
        risk: {
          alert: tok("risk-alert") as any,
          watch: tok("risk-watch") as any,
          none: tok("risk-low") as any,       // low chance: never a "safe" green
          unsupported: tok("risk-unknown") as any
        }
      },
      fontSize: {
        'main-heading': ['40px', { lineHeight: '48px', fontWeight: '800' }],
        'section-heading': ['32px', { lineHeight: '40px', fontWeight: '700' }],
        'body-text': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'secondary-text': ['14px', { lineHeight: '20px', fontWeight: '500' }],
      },
      backgroundImage: {
        "grad-forest": "var(--rk-grad-forest)",
        "grad-earth": "var(--rk-grad-earth)",
        "grad-river": "var(--rk-grad-river)",
      },
      fontFamily: {
        display: ["var(--font-manrope)", "var(--font-noto-bengali)", "var(--font-inter)", "sans-serif"],
        sans: [
          "var(--font-inter)",
          "var(--font-noto-bengali)",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif"
        ],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"]
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(23, 61, 50, 0.05), 0 1px 2px -1px rgba(23, 61, 50, 0.05)",
        float: "0 10px 25px -5px rgba(23, 61, 50, 0.08), 0 8px 10px -6px rgba(23, 61, 50, 0.04)",
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

