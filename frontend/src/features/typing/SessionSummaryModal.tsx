"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/services/api";

interface SessionSummaryModalProps {
  wpm: number;
  accuracy: number;
  durationSeconds: number;
  wpmHistory?: number[];
  failedWords: string[];
  onContinue: () => void;
}

export function SessionSummaryModal({
  wpm,
  accuracy,
  durationSeconds,
  wpmHistory = [],
  failedWords,
  onContinue,
}: SessionSummaryModalProps) {
  const router = useRouter();
  const xpGained = Math.max(10, Math.round(wpm * 0.4 + (accuracy / 100) * 20));

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        onContinue();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onContinue]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-5 text-center">
        <div>
          <span className="text-3xl">🎉</span>
          <h2 id="summary-title" className="text-xl font-bold text-white mt-1">
            ¡Fragmento Completado!
          </h2>
          <p className="text-neutral-400 text-xs mt-1">
            {durationSeconds > 0 ? `${Math.round(durationSeconds)} segundos de práctica` : "Buen trabajo"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3">
            <p className="text-xs text-neutral-400">Velocidad</p>
            <p className="text-2xl font-bold font-mono text-cyan-400 mt-0.5">{wpm} <span className="text-xs font-normal text-neutral-400">WPM</span></p>
          </div>
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3">
            <p className="text-xs text-neutral-400">Precisión</p>
            <p className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">{accuracy}%</p>
          </div>
        </div>

        {/* WPM Sparkline */}
        <WpmSparkline history={wpmHistory} currentWpm={wpm} />

        {/* XP Progress */}
        <XpProgress xpGained={xpGained} />

        {/* Failed Words List */}
        <FailedWordsList words={failedWords} />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          {failedWords.length > 0 && (
            <button
              type="button"
              onClick={() => router.push("/vocabulary")}
              className="flex-1 border border-neutral-700 hover:border-neutral-500 text-neutral-300 hover:text-white rounded-xl py-2.5 px-4 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
            >
              Practicar palabras débiles
            </button>
          )}
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 bg-white hover:bg-neutral-200 text-black font-semibold rounded-xl py-2.5 px-4 text-xs transition-colors flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <span>Continuar</span>
            <kbd className="text-[10px] bg-black/15 text-neutral-800 px-1 py-0.5 rounded font-mono">
              Enter ↵
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

function WpmSparkline({ history, currentWpm }: { history: number[]; currentWpm: number }) {
  const points = history.length >= 2 ? history : [Math.max(10, currentWpm - 8), currentWpm];
  const max = Math.max(...points, 30);
  const min = Math.max(0, Math.min(...points) - 5);
  const range = Math.max(max - min, 1);
  const width = 320;
  const height = 54;
  const pad = 6;

  const coords = points.map((val, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((val - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${coords.join(" L ")}`;
  const areaD = `${pathD} L ${width - pad},${height} L ${pad},${height} Z`;

  return (
    <div className="w-full bg-neutral-900/60 rounded-xl p-3 border border-neutral-800 text-left">
      <div className="flex justify-between items-center mb-1 text-xs text-neutral-400">
        <span>Curva de velocidad</span>
        <span className="font-mono text-cyan-400 font-medium">{currentWpm} WPM</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-12 overflow-visible">
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkGrad)" />
        <path d={pathD} fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function XpProgress({ xpGained }: { xpGained: number }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProgress(Math.min(100, Math.max(20, xpGained * 2.5)));
    }, 150);
    return () => clearTimeout(timer);
  }, [xpGained]);

  return (
    <div className="w-full bg-neutral-900/60 rounded-xl p-3 border border-neutral-800 text-left">
      <div className="flex justify-between items-center mb-1.5 text-xs">
        <span className="text-neutral-400">Experiencia ganada</span>
        <span className="font-mono text-amber-400 font-bold">+{xpGained} XP</span>
      </div>
      <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function FailedWordsList({ words }: { words: string[] }) {
  const [translations, setTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    words.slice(0, 10).forEach((w) => {
      api
        .lookupWord(w)
        .then((res) => {
          if (res) {
            setTranslations((prev) => ({ ...prev, [w]: res }));
          }
        })
        .catch(() => {});
    });
  }, [words]);

  if (words.length === 0) {
    return (
      <div className="w-full bg-emerald-950/40 border border-emerald-900/60 rounded-xl p-2.5 text-emerald-300 text-xs">
        ✨ ¡Escritura perfecta! 0 errores en este fragmento.
      </div>
    );
  }

  return (
    <div className="text-left w-full bg-neutral-900/60 rounded-xl p-3 border border-neutral-800">
      <p className="text-xs text-neutral-400 mb-2 font-medium">Palabras con error ({words.length}):</p>
      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
        {words.map((w) => (
          <span
            key={w}
            className="inline-flex items-center gap-1 bg-neutral-800 text-red-300 px-2 py-0.5 rounded text-xs border border-red-900/50"
          >
            <span className="font-mono font-medium">{w}</span>
            {translations[w] && <span className="text-neutral-400 text-[10px]">({translations[w]})</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
