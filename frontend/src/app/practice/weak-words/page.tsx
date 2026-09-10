"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import { TypingText } from "@/features/typing/TypingText";
import { TypingCaptureInput } from "@/features/typing/TypingCaptureInput";
import { TypingStats } from "@/features/typing/TypingStats";
import { WordHelpTooltip } from "@/features/typing/WordHelpTooltip";
import { buildTargetText, useTypingSession, type ChunkCompleteStats } from "@/features/typing/useTypingSession";
import type { WeakWordsSessionDTO } from "@/types";

type LoadState = "loading" | "ready" | "empty" | "error";

export default function WeakWordsPracticePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [session, setSession] = useState<WeakWordsSessionDTO | null>(null);
  const [done, setDone] = useState<{ wpm: number; accuracy: number } | null>(null);
  const [errorWord, setErrorWord] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    api
      .startWeakWordsSession()
      .then((data) => {
        setSession(data);
        setLoadState("ready");
      })
      .catch(() => setLoadState("empty"));
  }, [hasHydrated, token, router]);

  const { text: targetText, sentenceRanges } = session ? buildTargetText(session.sentences) : { text: "", sentenceRanges: [] };

  const handleWordError = useCallback((word: string) => setErrorWord(word), []);

  const handleComplete = useCallback(
    async (stats: ChunkCompleteStats) => {
      if (!session) return;
      const finished = await api.finishSession(session.session_id, stats);
      setDone({ wpm: finished.wpm, accuracy: finished.accuracy });
    },
    [session]
  );

  const { charStates, currentIndex, handleKeyDown, handleInput, liveWpm, liveAccuracy } = useTypingSession({
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

        {isDone && done ? (
          <div className="text-center py-16">
            <p className="text-white text-lg mb-2">Sesion completada</p>
            <p className="text-gray-400 text-sm mb-8">
              {done.wpm} WPM · {done.accuracy}% precision
            </p>
            <button
              onClick={() => router.push("/vocabulary")}
              className="bg-white text-black rounded px-4 py-2 text-sm font-medium"
            >
              Volver a Vocabulary
            </button>
          </div>
        ) : (
          <TypingText targetText={targetText} charStates={charStates} currentIndex={currentIndex} />
        )}
      </div>

      <WordHelpTooltip word={errorWord} />
    </div>
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
