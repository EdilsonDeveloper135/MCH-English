"use client";

import { useEffect, useState } from "react";
import { useTypingStore } from "@/stores/typingStore";
import type { ThemeMode } from "@/types/typing";

export type Theme = ThemeMode;

export const THEMES: { id: Theme; label: string; bg: string }[] = [
  { id: "oled", label: "OLED", bg: "#000000" },
  { id: "nord", label: "Nord", bg: "#1e222a" },
  { id: "catppuccin", label: "Catppuccin", bg: "#1e1e2e" },
  { id: "sepia", label: "Sepia", bg: "#fbf1c7" },
];

/** Single source of truth for the theme: the persisted preferences store. It used to
 * live in its own `mch_theme` localStorage key, which meant the theme selector in
 * Settings (writing to the store) changed nothing at all. */
export function useTheme() {
  const theme = useTypingStore((s) => s.preferences.theme);
  const setPreference = useTypingStore((s) => s.setPreference);

  return {
    theme,
    setTheme: (next: Theme) => setPreference("theme", next),
    themes: THEMES,
  };
}

/** Applies the selected theme to the document. Mounted once, high in the tree. */
export function useApplyTheme() {
  const theme = useTypingStore((s) => s.preferences.theme);

  useEffect(() => {
    if (theme === "oled") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);
}

export function useZenMode() {
  const [zenMode, setZenMode] = useState(false);

  useEffect(() => {
    setZenMode(localStorage.getItem("mch_zen_mode") === "true");
  }, []);

  const toggleZen = () => {
    setZenMode((prev) => {
      const next = !prev;
      localStorage.setItem("mch_zen_mode", String(next));
      return next;
    });
  };

  return { zenMode, toggleZen };
}

export function ThemeSelector() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Tema de color">
      {themes.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTheme(t.id)}
          aria-label={`Tema ${t.label}`}
          aria-pressed={theme === t.id}
          title={`Tema ${t.label}`}
          className={`w-4 h-4 rounded-full border transition-transform ${
            theme === t.id
              ? "scale-125 border-cyan-400 ring-1 ring-cyan-400"
              : "border-neutral-700 hover:scale-110"
          } focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none`}
          style={{ backgroundColor: t.bg }}
        />
      ))}
    </div>
  );
}
