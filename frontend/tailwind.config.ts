import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      keyframes: {
        "caret-blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-2px)" },
          "75%": { transform: "translateX(2px)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        fadeOut: {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        countUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(245, 158, 11, 0)" },
          "50%": { boxShadow: "0 0 12px 2px rgba(245, 158, 11, 0.15)" },
        },
      },
      animation: {
        "caret-blink": "caret-blink 1s infinite",
        shake: "shake 100ms ease-in-out",
        fadeIn: "fadeIn 200ms ease-out",
        fadeOut: "fadeOut 200ms ease-out",
        slideUp: "slideUp 200ms ease-out",
        slideDown: "slideDown 200ms ease-out",
        scaleIn: "scaleIn 200ms ease-out",
        countUp: "countUp 500ms ease-out",
        "pulse-glow": "pulse-glow 2s infinite",
      },
      // Mapped to the CSS variables in globals.css so `bg-surface`, `text-text-muted`
      // and friends actually generate CSS. Several screens were already using these
      // names against a config that only defined `surface`, so their controls rendered
      // with the browser's default colors (white text on white, invisible cursors).
      colors: {
        background: "var(--bg-primary)",
        surface: {
          DEFAULT: "var(--bg-surface)",
          primary: "var(--bg-primary)",
          border: "var(--border-color)",
        },
        text: {
          primary: "var(--text-primary)",
          muted: "var(--text-muted)",
        },
        accent: "var(--accent)",
        char: {
          pending: "var(--char-pending)",
          correct: "var(--char-correct)",
          incorrect: "var(--char-incorrect)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
