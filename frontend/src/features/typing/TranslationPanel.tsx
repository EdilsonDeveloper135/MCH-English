"use client";

import type { TranslationMode } from "@/types";

interface TranslationPanelProps {
  translation: string | null;
  mode: TranslationMode;
  revealed: boolean;
  onReveal: () => void;
}

export function TranslationPanel({ translation, mode, revealed, onReveal }: TranslationPanelProps) {
  if (!translation) return null;

  if (mode === "learning" || revealed) {
    return <div className="mt-6 text-gray-400 text-sm border-t border-gray-800 pt-4">{translation}</div>;
  }

  return (
    <button onClick={onReveal} className="mt-6 text-sm text-gray-400 underline">
      Ver traduccion
    </button>
  );
}
