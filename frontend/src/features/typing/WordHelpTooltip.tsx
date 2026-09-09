"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";

interface WordHelpTooltipProps {
  word: string | null;
}

/** Small, temporary hint shown after a typing error on a word -- looked up from the
 * local FreeDict dictionary (see backend/data/NOTICE.md), never AI-generated. */
export function WordHelpTooltip({ word }: WordHelpTooltipProps) {
  const [translations, setTranslations] = useState<string | null>(null);

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
    if (!translations) return;
    const timer = setTimeout(() => setTranslations(null), 4000);
    return () => clearTimeout(timer);
  }, [translations]);

  if (!word || !translations) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-800 text-sm text-gray-200 px-3 py-2 rounded shadow-lg">
      <span className="text-white font-mono">{word}</span>
      <span className="text-gray-500 mx-2">→</span>
      <span>{translations}</span>
    </div>
  );
}
