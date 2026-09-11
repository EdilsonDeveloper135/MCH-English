"use client";

import React, { useEffect, useState } from "react";
import type { SessionResult } from "@/types/typing";

interface SessionResultsProps {
  result: SessionResult;
  onAgain: () => void;
  onNext?: () => void;
  onQuickPractice?: () => void;
  onReplay?: () => void;
  onBackToLibrary: () => void;
  previousWpm?: number;
}

export function SessionResults({
  result,
  onAgain,
  onNext,
  onQuickPractice,
  onReplay,
  onBackToLibrary,
  previousWpm,
}: SessionResultsProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{ time: number; wpm: number } | null>(null);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === "Enter" && onNext) {
        e.preventDefault();
        onNext();
      } else if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onAgain();
      } else if (e.key === " " && onQuickPractice) {
        e.preventDefault();
        onQuickPractice();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onAgain, onNext, onQuickPractice]);

  const deltaWpm = previousWpm !== undefined ? result.wpm - previousWpm : null;

  // Chart coordinate calculations
  const wpmPoints = result.wpmOverTime && result.wpmOverTime.length > 0
    ? result.wpmOverTime
    : [
        { time: 0, wpm: 0 },
        { time: result.duration, wpm: result.wpm },
      ];

  const maxWpm = Math.max(...wpmPoints.map((p) => p.wpm), result.wpm, 10);
  const minWpm = Math.max(0, Math.min(...wpmPoints.map((p) => p.wpm), result.wpm - 20));
  const maxTime = Math.max(...wpmPoints.map((p) => p.time), result.duration, 1);

  const chartWidth = 600;
  const chartHeight = 160;

  const getSvgCoordinates = (point: { time: number; wpm: number }) => {
    const x = (point.time / maxTime) * chartWidth;
    const y = chartHeight - ((point.wpm - minWpm) / (maxWpm - minWpm || 1)) * (chartHeight - 30) - 15;
    return { x, y };
  };

  const svgPath = wpmPoints
    .map((point, index) => {
      const { x, y } = getSvgCoordinates(point);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="flex flex-col gap-8 w-full max-w-3xl mx-auto py-8 animate-fadeIn select-none">
      {/* Hero Performance Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-neutral-850">
        <div>
          <div className="flex items-baseline gap-4">
            <span className="text-7xl font-bold font-mono text-white tracking-tighter animate-countUp">
              {result.wpm}
            </span>
            <span className="text-xl font-mono text-neutral-400">PPM / WPM</span>
          </div>

          {deltaWpm !== null && (
            <p className={`text-sm font-mono mt-1 font-medium ${deltaWpm >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {deltaWpm >= 0 ? "+" : ""}
              {deltaWpm} respecto a la sesión anterior {deltaWpm >= 0 ? "▲" : "▼"}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6 text-right sm:text-right">
          <div>
            <p className="text-2xl font-mono font-bold text-white">{result.accuracy}%</p>
            <p className="text-xs text-neutral-400">Precisión</p>
          </div>
          <div>
            <p className="text-2xl font-mono font-bold text-white">{result.consistency}%</p>
            <p className="text-xs text-neutral-400">Consistencia</p>
          </div>
          <div>
            <p className="text-2xl font-mono font-bold text-white">{result.rawWpm}</p>
            <p className="text-xs text-neutral-400">PPM Bruto</p>
          </div>
          <div>
            <p className="text-2xl font-mono font-bold text-white">{result.duration.toFixed(1)}s</p>
            <p className="text-xs text-neutral-400">Tiempo activo</p>
          </div>
        </div>
      </div>

      {/* Temporal Chart: WPM vs Time */}
      <div className="bg-neutral-950/90 border border-neutral-900 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
          <span>VELOCIDAD A LO LARGO DEL TIEMPO (PPM vs Tiempo)</span>
          {hoveredPoint && (
            <span className="text-[var(--accent)] font-semibold">
              {hoveredPoint.time.toFixed(1)}s — {hoveredPoint.wpm} PPM
            </span>
          )}
        </div>

        <div className="relative w-full h-[180px] pt-4">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="#262626" strokeDasharray="4 4" />
            <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="#262626" />

            {/* Path */}
            <path d={svgPath} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />

            {/* Points */}
            {wpmPoints.map((point, i) => {
              const { x, y } = getSvgCoordinates(point);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="4"
                  className="fill-[var(--accent)] hover:fill-white cursor-pointer transition-colors"
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Detailed Diagnostics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Streak & Characters */}
        <div className="bg-neutral-900/30 border border-neutral-850 rounded-xl p-4 space-y-3">
          <p className="text-xs font-mono text-neutral-400 uppercase tracking-wider">Métricas de Flujo</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-400">Mejor racha:</span>
              <span className="font-mono text-amber-400 font-semibold">{result.bestStreak} palabras</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Correctos:</span>
              <span className="font-mono text-emerald-400">{result.characters.correct}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Errores:</span>
              <span className="font-mono text-rose-400">{result.characters.incorrect}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Extras:</span>
              <span className="font-mono text-neutral-400">{result.characters.extra}</span>
            </div>
          </div>
        </div>

        {/* Problematic Words */}
        <div className="bg-neutral-900/30 border border-neutral-850 rounded-xl p-4 space-y-3">
          <p className="text-xs font-mono text-neutral-400 uppercase tracking-wider">Palabras Problemáticas</p>
          {result.problematicWords && result.problematicWords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {result.problematicWords.slice(0, 5).map((pw, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono"
                >
                  {pw.word} ({pw.errors})
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-400 font-mono">¡Cero errores de palabra!</p>
          )}
        </div>

        {/* Problematic Keys */}
        <div className="bg-neutral-900/30 border border-neutral-850 rounded-xl p-4 space-y-3">
          <p className="text-xs font-mono text-neutral-400 uppercase tracking-wider">Teclas Débiles</p>
          {result.problematicKeys && result.problematicKeys.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {result.problematicKeys.slice(0, 5).map((pk, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono uppercase"
                >
                  {pk.key} ({pk.accuracy}%)
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-400 font-mono">¡Todas las teclas correctas!</p>
          )}
        </div>
      </div>

      {/* Action Buttons with Keyboard Shortcuts */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            className="bg-[var(--accent)] text-black font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <span>Siguiente frase</span>
            <kbd className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-mono">Enter ↵</kbd>
          </button>
        )}

        <button
          type="button"
          onClick={onAgain}
          className="bg-neutral-800 text-white font-medium px-5 py-2.5 rounded-xl hover:bg-neutral-700 transition-colors flex items-center gap-2"
        >
          <span>Otra vez</span>
          <kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono">R</kbd>
        </button>

        {onQuickPractice && (
          <button
            type="button"
            onClick={onQuickPractice}
            className="bg-neutral-800 text-amber-300 font-medium px-5 py-2.5 rounded-xl hover:bg-neutral-700 transition-colors flex items-center gap-2"
          >
            <span>Practicar errores</span>
            <kbd className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono">Espacio</kbd>
          </button>
        )}

        {onReplay && (
          <button
            type="button"
            onClick={onReplay}
            className="bg-neutral-900 border border-neutral-700 text-neutral-300 font-medium px-4 py-2.5 rounded-xl hover:text-white hover:border-neutral-600 transition-colors"
          >
            Replay ▶
          </button>
        )}

        <button
          type="button"
          onClick={onBackToLibrary}
          className="text-neutral-500 hover:text-neutral-300 text-sm px-4 py-2.5 transition-colors"
        >
          Biblioteca
        </button>
      </div>
    </div>
  );
}
