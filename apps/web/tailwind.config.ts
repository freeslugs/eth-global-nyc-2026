import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  // ./lib is included so arbitrary-value classes defined there (e.g. the pastel
  // CARD_TINTS) are scanned and generated — otherwise those cards render white.
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // Aegis brand palette
        ink: "#1c1917",
        paper: "#f4f3f0",
        night: "#1f1b18",
        accent: "#0b8457",
        mint: "#d9f2e6",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
      },
      fontFamily: {
        display: ["var(--font-display)", "Space Grotesk", "sans-serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
