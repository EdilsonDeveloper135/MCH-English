"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { api, ApiError } from "@/services/api";
import { TypingText } from "@/features/typing/TypingText";
import { TypingCaptureInput } from "@/features/typing/TypingCaptureInput";
import { AudioPlayer } from "@/features/dictation/AudioPlayer";
import { useTypingSession, type ChunkCompleteStats, type CharStatus } from "@/features/typing/useTypingSession";
import type { DictationRoundDTO, DictationSessionDTO, ErrorInput } from "@/types";

type LoadState = "loading" | "running" | "summary" | "empty" | "error";

function reconstructTyped(targetText: string, charStates: CharStatus[], errors: ErrorInput[]): string {
  const lastTypedAtPosition = new Map<number, string>();
  for (const err of errors) lastTypedAtPosition.set(err.position, err.typed_char);

  return targetText
    .split("")
    .map((char, i) => (charStates[i] === "incorrect" ? (lastTypedAtPosition.get(i) ?? "?") : char))
    .join("");
}

export default function DictationPage() {
  const params = useParams<{ textId: string }>();
  const textId = params.textId;
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [session, setSession] = useState<DictationSessionDTO | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [lastResult, setLastResult] = useState<{ expected: string; typed: string; accuracy: number; correct_words: number; incorrect_words: number } | null>(
    null
  );
  const [roundAccuracies, setRoundAccuracies] = useState<number[]>([]);
  const [summary, setSummary] = useState<{ rounds: number; averageAccuracy: number } | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    api
      .createDictationSession(textId)
      .then((data) => {
        setSession(data);
        setLoadState("running");
      })
      .catch((err) => {
        setLoadState(err instanceof ApiError && err.status === 404 ? "empty" : "error");
      });
  }, [hasHydrated, token, textId, router]);

  const handleRoundDone = useCallback(
    (result: { expected: string; typed: string; accuracy: number; correct_words: number; incorrect_words: number }) => {
      setLastResult(result);
      setRoundAccuracies((prev) => [...prev, result.accuracy]);
    },
    []
  );

  async function handleNextRound() {
    if (!session) return;
    const isLast = roundIndex >= session.rounds.length - 1;
    if (isLast) {
      await api.finishDictationSession(session.session_id).catch(() => {});
      const average = roundAccuracies.length
        ? Math.round((roundAccuracies.reduce((sum, a) => sum + a, 0) / roundAccuracies.length) * 10) / 10
        : 0;
      setSummary({ rounds: session.rounds.length, averageAccuracy: average });
      setLoadState("summary");
      return;
    }
    setRoundIndex((i) => i + 1);
    setLastResult(null);
  }

  if (loadState === "loading") return <Centered text="Preparando sesion..." />;
  if (loadState === "error") return <Centered text="No se pudo cargar el texto." />;
  if (loadState === "empty") {
    return (
      <Centered text="Este texto no tiene oraciones para practicar Dictation todavia.">
        <button onClick={() => router.push("/library")} className="mt-4 underline text-sm">
          Volver a la biblioteca
        </button>
      </Centered>
    );
  }

  if (loadState === "summary" && summary) {
    return (
      <Centered text="Sesion de Dictation completada">
        <p className="text-gray-400 text-sm mt-2">
          {summary.rounds} oraciones · precision promedio {summary.averageAccuracy}%
        </p>
        <button
          onClick={() => router.push("/library")}
          className="mt-6 bg-white text-black rounded px-4 py-2 text-sm font-medium"
        >
          Volver a la biblioteca
        </button>
      </Centered>
    );
  }

  if (loadState === "running" && session) {
    const round = session.rounds[roundIndex];
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-3xl">
          <p className="text-gray-400 text-sm mb-6">
            Dictation · {roundIndex + 1}/{session.rounds.length}
          </p>

          {lastResult ? (
            <RoundResult result={lastResult} onNext={handleNextRound} isLast={roundIndex >= session.rounds.length - 1} />
          ) : (
            <DictationRoundView
              key={round.sentence_id}
              round={round}
              sessionId={session.session_id}
              onDone={handleRoundDone}
            />
          )}
        </div>
      </div>
    );
  }

  return null;
}

function DictationRoundView({
  round,
  sessionId,
  onDone,
}: {
  round: DictationRoundDTO;
  sessionId: string;
  onDone: (result: { expected: string; typed: string; accuracy: number; correct_words: number; incorrect_words: number }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const targetText = round.content;

  const handleComplete = useCallback(
    async (stats: ChunkCompleteStats) => {
      const typed = reconstructTyped(targetText, stats.finalCharStates, stats.errors);
      const result = await api.submitDictationAttempt({
        dictation_session_id: sessionId,
        sentence_id: round.sentence_id,
        typed,
        correct_characters: stats.correct_characters,
        incorrect_characters: stats.incorrect_characters,
        total_characters: stats.total_characters,
        duration_seconds: stats.duration_seconds,
      });
      onDone({
        expected: result.expected,
        typed: result.typed,
        accuracy: result.accuracy,
        correct_words: result.correct_words,
        incorrect_words: result.incorrect_words,
      });
    },
    [targetText, sessionId, round, onDone]
  );

  const { charStates, currentIndex, handleKeyDown, handleInput, liveAccuracy } = useTypingSession({
    targetText,
    sentenceRanges: [],
    onComplete: handleComplete,
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="cursor-text" onClick={() => inputRef.current?.focus()}>
      <TypingCaptureInput inputRef={inputRef} onKeyDown={handleKeyDown} onInput={handleInput} />

      <AudioPlayer sentenceId={round.sentence_id} />

      <TypingText targetText={targetText} charStates={charStates} currentIndex={currentIndex} hidePending />

      <p className="text-gray-400 text-xs mt-6">{liveAccuracy}%</p>
    </div>
  );
}

function RoundResult({
  result,
  onNext,
  isLast,
}: {
  result: { expected: string; typed: string; accuracy: number; correct_words: number; incorrect_words: number };
  onNext: () => void;
  isLast: boolean;
}) {
  return (
    <div className="py-10">
      <p className="font-mono text-lg text-white mb-1">{result.expected}</p>
      {result.typed !== result.expected && (
        <p className="font-mono text-sm text-gray-400 mb-4">Escribiste: {result.typed}</p>
      )}
      <p className="text-white text-lg mb-2 mt-6">{result.accuracy}% de precision</p>
      <p className="text-gray-400 text-sm mb-8">
        {result.correct_words} palabras correctas · {result.incorrect_words} incorrectas
      </p>
      <button onClick={onNext} className="bg-white text-black rounded px-4 py-2 text-sm font-medium">
        {isLast ? "Terminar" : "Siguiente"}
      </button>
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
