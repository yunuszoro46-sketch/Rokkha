import type { Config } from "tailwindcss";

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
          alert: "#B94A48",     // High / severe alert
          watch: "#C69A50",     // Watch level
          none: "#78958A",      // No active alert (restrained sage, never false green safety)
          unsupported: "#94A3B8" // Grey for unsupported / radar blind
        }
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif"
        ],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"]
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(38, 59, 50, 0.05), 0 1px 2px -1px rgba(38, 59, 50, 0.05)",
        float: "0 10px 25px -5px rgba(38, 59, 50, 0.08), 0 8px 10px -6px rgba(38, 59, 50, 0.04)",
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

