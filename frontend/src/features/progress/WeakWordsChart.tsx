"use client";

import type { VocabularyItemDTO } from "@/types";
import { EmptyState } from "./EmptyState";

// Must match backend app/services/vocabulary_service.py's WEAK_MASTERY_THRESHOLD --
// /vocabulary/weak only floors on encounter count, not mastery, so this chart applies
// the mastery ceiling itself before plotting.
const WEAK_MASTERY_THRESHOLD = 70;

interface WeakWordsChartProps {
  items: VocabularyItemDTO[];
}

function masteryColor(value: number): string {
  if (value >= 80) return "#22c55e";
  if (value >= 50) return "#eab308";
  return "#ef4444";
}

export function WeakWordsChart({ items }: WeakWordsChartProps) {
  const weak = items.filter((item) => item.mastery_score < WEAK_MASTERY_THRESHOLD);

  return (
    <div className="border border-gray-800 rounded p-4">
      <p className="text-xs text-gray-500 mb-3">Palabras mas dificiles</p>
      {weak.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {weak.map((item) => (
            <div key={item.word} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-mono w-24 truncate">{item.word}</span>
              <div className="flex-1 h-3 bg-gray-900 rounded overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max(item.mastery_score, 2)}%`,
                    backgroundColor: masteryColor(item.mastery_score),
                  }}
                />
              </div>
              <span className="text-xs text-gray-500 w-10 text-right">{Math.round(item.mastery_score)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
