"use client";

import React, { useMemo } from "react";

interface ConfettiParticle {
  id: number;
  left: string;
  delay: string;
  duration: string;
  color: string;
  size: string;
}

interface SessionCompleteProps {
  wpm?: number;
  accuracy?: number;
  durationSeconds?: number;
  onContinue: () => void;
  title?: string;
  subtitle?: string;
}

const COLORS = [
  "#22d3ee", // cyan-400
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ec4899", // pink-500
  "#8b5cf6", // violet-500
  "#38bdf8", // sky-400
  "#fbbf24", // amber-400
];

export function SessionComplete({
  wpm,
  accuracy,
  durationSeconds,
  onContinue,
  title = "¡Sesión Completada!",
  subtitle = "Has completado la práctica con éxito.",
}: SessionCompleteProps) {
  // Generate deterministic particles for SSR/CSR consistency
  const particles = useMemo<ConfettiParticle[]>(() => {
    return Array.from({ length: 32 }, (_, i) => ({
      id: i,
      left: `${(i * 3.125) % 100}%`,
      delay: `${(i * 0.07).toFixed(2)}s`,
      duration: `${(1.8 + (i % 5) * 0.3).toFixed(2)}s`,
      color: COLORS[i % COLORS.length],
      size: `${6 + (i % 4) * 2}px`,
    }));
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-complete-title"
      className="relative overflow-hidden bg-neutral-900/90 border border-neutral-800 rounded-2xl p-8 max-w-md mx-auto text-center shadow-2xl backdrop-blur-sm"
    >
      {/* CSS-only Confetti Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute top-0 rounded-sm opacity-90"
            style={{
              left: p.left,
              width: p.size,
              height: `${parseInt(p.size, 10) * 1.5}px`,
              backgroundColor: p.color,
              animationName: "confetti-fall",
              animationDuration: p.duration,
              animationDelay: p.delay,
              animationTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
              animationIterationCount: "infinite",
            }}
          />
        ))}
      </div>

      <div className="relative z-10 space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl">
          🎉
        </div>

        <div>
          <h2 id="session-complete-title" className="text-2xl font-bold text-white tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-neutral-400 mt-1">{subtitle}</p>
        </div>

        {(wpm !== undefined || accuracy !== undefined) && (
          <div className="grid grid-cols-2 gap-3 py-3 border-y border-neutral-800/80 font-mono">
            {wpm !== undefined && (
              <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800">
                <span className="text-xs text-neutral-500 block">Velocidad</span>
                <span className="text-xl font-bold text-white">{wpm} <span className="text-xs text-neutral-400">WPM</span></span>
              </div>
            )}
            {accuracy !== undefined && (
              <div className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800">
                <span className="text-xs text-neutral-500 block">Precisión</span>
                <span className="text-xl font-bold text-emerald-400">{accuracy}%</span>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onContinue}
          className="w-full py-3 px-5 rounded-xl font-semibold text-sm bg-[var(--accent)] text-black hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
