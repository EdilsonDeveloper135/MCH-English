"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import { TypingText } from "@/features/typing/TypingText";
import { TypingCaptureInput } from "@/features/typing/TypingCaptureInput";
import { TypingStats } from "@/features/typing/TypingStats";
import { WordHelpTooltip } from "@/features/typing/WordHelpTooltip";
import { buildTargetText, useTypingSession, type ChunkCompleteStats } from "@/features/typing/useTypingSession";
import type { WeakWordsSessionDTO } from "@/types";

type LoadState = "loading" | "ready" | "empty" | "error";

function WeakWordsPractice() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Set by "practicar <palabra>" after mistyping the same word twice.
  const focusWord = searchParams.get("word");

  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [session, setSession] = useState<WeakWordsSessionDTO | null>(null);
  const [done, setDone] = useState<{ wpm: number; accuracy: number } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errorWordInfo, setErrorWordInfo] = useState<{ word: string; position: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    api
      .startWeakWordsSession(focusWord ?? undefined)
      .then((data) => {
        setSession(data);
        setLoadState("ready");
      })
      .catch(() => setLoadState("empty"));
  }, [hasHydrated, token, router, focusWord]);

  const { text: targetText, sentenceRanges } = session
    ? buildTargetText(session.sentences)
    : { text: "", sentenceRanges: [] };

  const handleWordError = useCallback((word: string, position: number) => setErrorWordInfo({ word, position }), []);

  const handleComplete = useCallback(
    async (stats: ChunkCompleteStats) => {
      if (!session) return;
      try {
        const finished = await api.finishSession(session.session_id, stats);
        setDone({ wpm: finished.wpm, accuracy: finished.accuracy });
        setSaveError(null);
      } catch {
        setSaveError("No se pudo guardar la sesion. Revisa tu conexion.");
      }
    },
    [session]
  );

  const { charStates, currentIndex, extraChars, handleKeyDown, handleInput, liveWpm, liveAccuracy } = useTypingSession({
    targetText,
    sentenceRanges,
    onComplete: handleComplete,
    onWordError: handleWordError,
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, [session]);

  if (loadState === "loading") return <Centered text="Preparando sesion..." />;
  if (loadState === "error") return <Centered text="No se pudo cargar la sesion." />;
  if (loadState === "empty") {
    return (
      <Centered text="Todavia no hay suficientes palabras debiles registradas. Practica mas textos primero.">
        <button onClick={() => router.push("/vocabulary")} className="mt-4 underline text-sm">
          Volver a Vocabulary
        </button>
      </Centered>
    );
  }

  const progressPercent = targetText.length ? (currentIndex / targetText.length) * 100 : 0;
  const isDone = currentIndex >= targetText.length && targetText.length > 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <TypingCaptureInput inputRef={inputRef} onKeyDown={handleKeyDown} onInput={handleInput} />

      <div className="w-full max-w-3xl cursor-text" onClick={() => inputRef.current?.focus()}>
        <TypingStats wpm={liveWpm} accuracy={liveAccuracy} progressPercent={progressPercent} />

        {focusWord && !isDone && (
          <p className="text-xs text-neutral-500 mt-2">
            Enfocando <span className="text-[var(--accent)] font-mono">{focusWord}</span>
          </p>
        )}

        {saveError && <p className="text-sm text-red-300 mt-4">{saveError}</p>}

        {isDone && done ? (
          <div className="text-center py-16">
            <p className="text-white text-lg mb-2">Sesion completada</p>
            <p className="text-gray-400 text-sm mb-8">
              {done.wpm} WPM · {done.accuracy}% precision
            </p>
            <button
              onClick={() => router.push("/vocabulary")}
              className="bg-white text-black rounded px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
            >
              Volver a Vocabulary
            </button>
          </div>
        ) : (
          <TypingText
            targetText={targetText}
            charStates={charStates}
            currentIndex={currentIndex}
            extraChars={extraChars}
          />
        )}
      </div>

      <WordHelpTooltip word={errorWordInfo?.word ?? null} activeCharIndex={errorWordInfo?.position} />
    </div>
  );
}

export default function WeakWordsPracticePage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<Centered text="Preparando sesion..." />}>
      <WeakWordsPractice />
    </Suspense>
  );
}

function Centered({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="text-gray-400 text-sm">{text}</p>
      {children}
    </div>
  );
}
