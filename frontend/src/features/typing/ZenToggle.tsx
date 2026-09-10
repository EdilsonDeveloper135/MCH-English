"use client";

import { useEffect, useState } from "react";

export type Theme = "oled" | "nord" | "catppuccin" | "sepia";

export const THEMES: { id: Theme; label: string; bg: string }[] = [
  { id: "oled", label: "OLED", bg: "#000000" },
  { id: "nord", label: "Nord", bg: "#1e222a" },
  { id: "catppuccin", label: "Catppuccin", bg: "#1e1e2e" },
  { id: "sepia", label: "Sepia", bg: "#fbf1c7" },
];

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("oled");

  useEffect(() => {
    const saved = (localStorage.getItem("mch_theme") as Theme) || "oled";
    setThemeState(saved);
    if (saved === "oled") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    localStorage.setItem("mch_theme", next);
    if (next === "oled") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", next);
    }
  };

  return { theme, setTheme, themes: THEMES };
}

export function useZenMode() {
  const [zenMode, setZenMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("mch_zen_mode") === "true";
    setZenMode(saved);
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

export function ZenToggle({
  zenMode,
  onToggle,
}: {
  zenMode: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={zenMode ? "Desactivar modo Zen" : "Activar modo Zen"}
      className={`px-2 py-1 text-xs rounded transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
        zenMode
          ? "bg-cyan-950 text-cyan-300 border border-cyan-700"
          : "text-gray-400 hover:text-white border border-transparent"
      }`}
      title="Modo Zen: oculta métricas y distracciones durante el tipeo"
    >
      🧘 {zenMode ? "Zen On" : "Zen"}
    </button>
  );
}

export function ThemeSelector() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="flex items-center gap-1">
      {themes.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTheme(t.id)}
          aria-label={`Tema ${t.label}`}
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
