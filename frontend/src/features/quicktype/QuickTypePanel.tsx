"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  buildClientChunks,
  countWords,
  MAX_QUICKTYPE_WORDS,
  type ClientChunk,
} from "./clientChunking";
import { useTypingSession, type ChunkCompleteStats } from "@/features/typing/useTypingSession";
import { TypingCaptureInput } from "@/features/typing/TypingCaptureInput";
import { TypingDisplay } from "@/features/typing/components/TypingDisplay";
import { FluidCaret } from "@/features/typing/components/FluidCaret";
import { LiveStats } from "@/features/typing/components/LiveStats";
import { ProgressBar } from "@/features/typing/components/ProgressBar";

interface QuickTypePanelProps {
  onSaveToLibrary?: (rawText: string) => void;
}

export function QuickTypePanel({ onSaveToLibrary }: QuickTypePanelProps) {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [chunks, setChunks] = useState<ClientChunk[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [mode, setMode] = useState<"input" | "practice" | "results">("input");
  const [resetKey, setResetKey] = useState(0);
  const [lastStats, setLastStats] = useState<ChunkCompleteStats | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const wordCount = countWords(rawText);
  const isOverLimit = wordCount > MAX_QUICKTYPE_WORDS;
  const currentChunk = chunks[currentChunkIndex] ?? null;

  const handleStartPractice = () => {
    if (!rawText.trim() || isOverLimit) return;
    const generated = buildClientChunks(rawText);
    if (generated.length === 0) return;
    setChunks(generated);
    setCurrentChunkIndex(0);
    setLastStats(null);
    setMode("practice");
  };

  const handleChunkComplete = useCallback((stats: ChunkCompleteStats) => {
    setLastStats(stats);
    setMode("results");
  }, []);

  const session = useTypingSession({
    targetText: currentChunk?.text ?? "",
    sentenceRanges: currentChunk?.sentenceRanges ?? [],
    resetKey,
    onComplete: handleChunkComplete,
  });

  // Focus capture input when entering practice mode
  useEffect(() => {
    if (mode === "practice") {
      inputRef.current?.focus();
    }
  }, [mode, resetKey]);

  const handleRetry = () => {
    setResetKey((k) => k + 1);
    setMode("practice");
  };

  const handleNextChunk = () => {
    if (currentChunkIndex + 1 < chunks.length) {
      setCurrentChunkIndex((i) => i + 1);
      setResetKey((k) => k + 1);
      setMode("practice");
    }
  };

  const handleSaveToLibrary = () => {
    if (onSaveToLibrary) {
      onSaveToLibrary(rawText);
    } else {
      // Store in session storage and navigate to library
      if (typeof window !== "undefined") {
        const title = rawText.slice(0, 40).trim() || "Texto QuickType";
        sessionStorage.setItem(
          "quicktype_save_text",
          JSON.stringify({ title, content: rawText })
        );
        sessionStorage.setItem("mch_prefilled_text", rawText);
        router.push("/library?import=quicktype");
      }
    }
  };

  if (mode === "input") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Práctica Libre (QuickType)</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Pega cualquier texto en inglés para comenzar a escribir de inmediato sin guardarlo en tu biblioteca.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="quicktype-textarea" className="font-medium text-neutral-300">
              Texto de práctica
            </label>
            <span
              className={`font-mono ${
                isOverLimit ? "text-red-400 font-bold" : "text-neutral-500"
              }`}
            >
              {wordCount} / {MAX_QUICKTYPE_WORDS} palabras
            </span>
          </div>

          <textarea
            id="quicktype-textarea"
            rows={8}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono transition-colors resize-y"
            placeholder="Pega aquí tu fragmento de texto en inglés..."
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />

          {isOverLimit && (
            <p className="text-xs text-red-400">
              El texto excede el límite máximo de 2.000 palabras para práctica rápida.
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-neutral-500 max-w-sm">
              <span className="font-semibold text-neutral-400">Nota:</span> Esta práctica es efímera y
              utiliza un segmentado cliente básico. No se guardan sesiones en la base de datos.
            </div>

            <button
              type="button"
              onClick={handleStartPractice}
              disabled={!rawText.trim() || isOverLimit}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-[var(--accent)] text-black hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Comenzar a escribir
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "results" && lastStats && currentChunk) {
    const finalAccuracy =
      lastStats.total_characters > 0
        ? Math.round((lastStats.correct_characters / lastStats.total_characters) * 100)
        : 100;
    const finalWpm = Math.round(
      lastStats.correct_characters / 5 / (lastStats.duration_seconds / 60)
    );

    return (
      <div className="max-w-xl mx-auto space-y-6 text-center py-8">
        <div className="p-8 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-2xl space-y-6">
          <div>
            <span className="text-3xl">⚡</span>
            <h2 className="text-2xl font-bold text-white mt-2">Fragmento completado</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Fragmento {currentChunkIndex + 1} de {chunks.length} ({currentChunk.wordCount} palabras)
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 font-mono py-2">
            <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800">
              <span className="text-xs text-neutral-500 block">Velocidad</span>
              <span className="text-2xl font-bold text-white">{finalWpm}</span>
              <span className="text-[10px] text-neutral-400 block">WPM</span>
            </div>
            <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800">
              <span className="text-xs text-neutral-500 block">Precisión</span>
              <span className="text-2xl font-bold text-emerald-400">{finalAccuracy}%</span>
              <span className="text-[10px] text-neutral-400 block">ACC</span>
            </div>
            <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800">
              <span className="text-xs text-neutral-500 block">Tiempo</span>
              <span className="text-2xl font-bold text-white">
                {Math.round(lastStats.duration_seconds)}s
              </span>
              <span className="text-[10px] text-neutral-400 block">segundos</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleRetry}
              className="flex-1 py-2.5 rounded-xl border border-neutral-700 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
            >
              Repetir fragmento [R]
            </button>
            {currentChunkIndex + 1 < chunks.length ? (
              <button
                type="button"
                onClick={handleNextChunk}
                className="flex-1 py-2.5 rounded-xl bg-[var(--accent)] text-black text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Siguiente fragmento [Enter]
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMode("input")}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 text-white text-sm font-semibold hover:bg-neutral-700 transition-colors"
              >
                Nuevo texto
              </button>
            )}
          </div>

          <div className="pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={handleSaveToLibrary}
              className="text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1.5"
            >
              <span>📁</span> Guardar este texto en mi biblioteca
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Practice mode
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMode("input")}
            className="text-xs text-neutral-400 hover:text-white transition-colors"
          >
            ← Volver al editor
          </button>
          <span className="text-neutral-700">|</span>
          <span className="text-xs font-mono text-neutral-500">
            Fragmento {currentChunkIndex + 1} de {chunks.length}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSaveToLibrary}
          className="text-xs text-neutral-400 hover:text-cyan-400 transition-colors"
        >
          Guardar en biblioteca
        </button>
      </div>

      <ProgressBar
        percent={
          chunks.length > 0
            ? Math.min(
                100,
                Math.round(
                  ((currentChunkIndex + (currentChunk && currentChunk.text.length > 0 ? session.currentIndex / currentChunk.text.length : 0)) /
                    chunks.length) *
                    100
                )
              )
            : 0
        }
      />

      <div className="flex justify-between items-center">
        <LiveStats
          wpm={session.liveWpm}
          accuracy={session.liveAccuracy}
          errors={0}
          elapsedSeconds={0}
          progressPercent={
            currentChunk ? (session.currentIndex / currentChunk.text.length) * 100 : 0
          }
        />
      </div>

      <div
        ref={containerRef}
        className="relative min-h-[220px] p-6 bg-neutral-950/80 rounded-2xl border border-neutral-900 shadow-xl cursor-text select-none"
        onClick={() => inputRef.current?.focus()}
      >
        <TypingCaptureInput
          inputRef={inputRef}
          onKeyDown={session.handleKeyDown}
          onInput={session.handleInput}
        />

        <FluidCaret
          containerRef={containerRef}
          currentIndex={session.currentIndex}
          isComplete={session.isComplete}
        />

        {currentChunk && (
          <TypingDisplay
            targetText={currentChunk.text}
            charStates={session.charStates}
            currentIndex={session.currentIndex}
            extraChars={session.extraChars}
          />
        )}
      </div>
    </div>
  );
}
