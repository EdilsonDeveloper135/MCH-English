"use client";
import { StreakBar } from "./components/StreakBar";

interface TypingStatsProps {
  wpm: number;
  accuracy: number;
  progressPercent: number;
  streak?: number;
}

export function TypingStats({ wpm, accuracy, progressPercent, streak }: TypingStatsProps) {
  return (
    <div className="flex items-center justify-between text-sm text-gray-400 mb-8" role="region" aria-label="Estadísticas de la sesión">
      <div className="flex items-center gap-6 font-mono">
        <div className="flex items-center gap-1.5">
          <span
            key={wpm}
            aria-hidden="true"
            className="inline-block font-semibold text-white transition-opacity duration-150 animate-countUp"
          >
            {wpm}
          </span>
          <span className="text-neutral-500 text-xs" aria-hidden="true">WPM</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="font-semibold text-white">{accuracy}%</span>
          <span className="text-neutral-500 text-xs" aria-hidden="true">ACC</span>
        </div>
        {streak !== undefined && <StreakBar streak={streak} className="hidden sm:flex" />}
      </div>

      <div className="flex items-center gap-3">
        <div
          className="w-36 sm:w-44 h-1.5 bg-gray-800 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(progressPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso del texto"
        >
          <div
            className="h-full bg-cyan-400 rounded-full transition-[width] duration-200 ease-in-out"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Screen reader live updates for WCAG 4.1.3 */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {`Velocidad: ${wpm} palabras por minuto. Precisión: ${accuracy} por ciento. Progreso: ${Math.round(progressPercent)} por ciento.`}
      </div>
    </div>
  );
}
