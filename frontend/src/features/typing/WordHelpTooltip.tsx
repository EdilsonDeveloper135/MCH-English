"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";

interface WordHelpTooltipProps {
  word: string | null;
  activeCharIndex?: number;
}

/** Small, temporary hint shown after a typing error on a word -- looked up from the
 * local FreeDict dictionary (see backend/data/NOTICE.md), positioned contextually above
 * the active error word. */
export function WordHelpTooltip({ word, activeCharIndex }: WordHelpTooltipProps) {
  const [translations, setTranslations] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    setTranslations(null);
    if (!word) return;

    let cancelled = false;
    api.lookupWord(word).then((result) => {
      if (!cancelled) setTranslations(result);
    });
    return () => {
      cancelled = true;
    };
  }, [word]);

  useEffect(() => {
    if (!translations) {
      setCoords(null);
      return;
    }

    if (typeof activeCharIndex === "number" && typeof document !== "undefined") {
      const charEl = document.querySelector<HTMLElement>(`[data-char-index="${activeCharIndex}"]`);
      if (charEl) {
        const rect = charEl.getBoundingClientRect();
        // Position above the word if there's space, else below
        const top = rect.top >= 48 ? rect.top - 38 : rect.bottom + 8;
        const maxLeft = typeof window !== "undefined" ? window.innerWidth - 220 : 300;
        setCoords({ top, left: Math.min(maxLeft, Math.max(16, rect.left)) });
      }
    }

    const timer = setTimeout(() => {
      setTranslations(null);
      setCoords(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [translations, activeCharIndex]);

  if (!word || !translations) return null;

  const style: React.CSSProperties = coords
    ? { position: "fixed", top: `${coords.top}px`, left: `${coords.left}px`, zIndex: 30 }
    : {};

  const className = coords
    ? "bg-neutral-900/95 backdrop-blur-sm border border-neutral-700 text-sm text-gray-200 px-3 py-1.5 rounded-lg shadow-2xl transition-all duration-200"
    : "fixed bottom-8 left-1/2 -translate-x-1/2 bg-neutral-900 border border-neutral-800 text-sm text-gray-200 px-3 py-2 rounded shadow-lg";

  return (
    <div style={style} className={className}>
      <span className="text-cyan-400 font-mono font-medium">{word}</span>
      <span className="text-gray-400 mx-2">→</span>
      <span className="text-white">{translations}</span>
    </div>
  );
}
