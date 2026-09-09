"use client";

interface TranslationPanelProps {
  translation: string | null;
}

export function TranslationPanel({ translation }: TranslationPanelProps) {
  if (!translation) return null;

  return <div className="mt-6 text-gray-400 text-sm border-t border-gray-800 pt-4">{translation}</div>;
}
