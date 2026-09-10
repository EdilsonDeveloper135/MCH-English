"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { api, ApiError } from "@/services/api";
import { TypingText } from "@/features/typing/TypingText";
import { TypingCaptureInput } from "@/features/typing/TypingCaptureInput";
import { MissingWordsText, buildBlankTargetText } from "@/features/recall/MissingWordsText";
import { useTypingSession, type ChunkCompleteStats } from "@/features/typing/useTypingSession";
import { reconstructTyped } from "@/features/typing/utils";
import type { RecallMode, RecallRoundDTO, RecallSessionDTO, TextDTO } from "@/types";

type LoadState = "loading" | "pick-mode" | "running" | "summary" | "empty" | "error";

export default function RecallPage() {
  const params = useParams<{ textId: string }>();
  const textId = params.textId;
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [text, setText] = useState<TextDTO | null>(null);
  const [mode, setMode] = useState<RecallMode | null>(null);
  const [session, setSession] = useState<RecallSessionDTO | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [lastResult, setLastResult] = useState<{
    expected: string;
    typed: string | null;
    accuracy: number;
    correct_words: number;
    incorrect_words: number;
  } | null>(null);
  const [roundAccuracies, setRoundAccuracies] = useState<number[]>([]);
  const [summary, setSummary] = useState<{ rounds: number; averageAccuracy: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    api
      .getText(textId)
      .then((t) => {
        setText(t);
        setLoadState("pick-mode");
      })
      .catch(() => setLoadState("error"));
  }, [hasHydrated, token, textId, router]);

  async function startMode(selectedMode: RecallMode) {
    setError(null);
    try {
      const data = await api.createRecallSession(textId, selectedMode);
      setMode(selectedMode);
      setSession(data);
      setRoundIndex(0);
      setLastResult(null);
      setRoundAccuracies([]);
      setLoadState("running");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setLoadState("empty");
      } else {
        setError("No se pudo iniciar la sesion de recall.");
      }
    }
  }

  const handleRoundDone = useCallback(
    (result: { expected: string; typed: string | null; accuracy: number; correct_words: number; incorrect_words: number }) => {
      setLastResult(result);
      setRoundAccuracies((prev) => [...prev, result.accuracy]);
    },
    []
  );

  async function handleNextRound() {
    if (!session) return;
    const isLast = roundIndex >= session.rounds.length - 1;
    if (isLast) {
      await api.finishRecallSession(session.session_id).catch(() => {});
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

  if (loadState === "loading") return <Centered text="Cargando..." />;
  if (loadState === "error") return <Centered text="No se pudo cargar el texto." />;
  if (loadState === "empty") {
    return (
      <Centered text="No hay suficientes oraciones para practicar Recall con este texto todavia.">
        <button onClick={() => router.push("/library")} className="mt-4 underline text-sm">
          Volver a la biblioteca
        </button>
      </Centered>
    );
  }

  if (loadState === "pick-mode") {
    const canSpanishToEnglish = text?.has_translation && text.alignment_status === "confirmed";
    return (
      <Centered text={`Recall - ${text?.title ?? ""}`}>
        <div className="flex flex-col gap-3 mt-6 w-64">
          <button
            onClick={() => startMode("missing_words")}
            className="bg-white text-black rounded px-4 py-2 text-sm font-medium"
          >
            Missing Words
          </button>
          {canSpanishToEnglish && (
            <button
              onClick={() => startMode("spanish_to_english")}
              className="bg-white text-black rounded px-4 py-2 text-sm font-medium"
            >
              Espanol → Ingles
            </button>
          )}
        </div>
        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
        <button onClick={() => router.push("/library")} className="mt-6 underline text-sm text-gray-400">
          Volver
        </button>
      </Centered>
    );
  }

  if (loadState === "summary" && summary) {
    return (
      <Centered text="Sesion de Recall completada">
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

  if (loadState === "running" && session && mode) {
    const round = session.rounds[roundIndex];
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-3xl">
          <p className="text-gray-400 text-sm mb-6">
            Recall · {mode === "missing_words" ? "Missing Words" : "Espanol → Ingles"} · {roundIndex + 1}/
            {session.rounds.length}
          </p>

          {lastResult ? (
            <RoundResult result={lastResult} onNext={handleNextRound} isLast={roundIndex >= session.rounds.length - 1} />
          ) : (
            <RecallRoundView
              key={round.sentence_id}
              round={round}
              mode={mode}
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

function RecallRoundView({
  round,
  mode,
  sessionId,
  onDone,
}: {
  round: RecallRoundDTO;
  mode: RecallMode;
  sessionId: string;
  onDone: (result: {
    expected: string;
    typed: string | null;
    accuracy: number;
    correct_words: number;
    incorrect_words: number;
  }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const targetText =
    mode === "missing_words" ? buildBlankTargetText(round.content ?? "", round.blanks ?? []) : round.english_content ?? "";
  const fullSentence = mode === "missing_words" ? round.content ?? "" : round.english_content ?? "";

  const handleComplete = useCallback(
    async (stats: ChunkCompleteStats) => {
      const typed = reconstructTyped(targetText, stats.finalCharStates, stats.errors);
      const result = await api.submitRecallAttempt({
        recall_session_id: sessionId,
        sentence_id: round.sentence_id,
        typed,
        blanks: mode === "missing_words" ? round.blanks ?? undefined : undefined,
        correct_characters: stats.correct_characters,
        incorrect_characters: stats.incorrect_characters,
        total_characters: stats.total_characters,
        duration_seconds: stats.duration_seconds,
      });
      onDone({
        expected: fullSentence,
        typed: mode === "spanish_to_english" ? result.typed : null,
        accuracy: result.accuracy,
        correct_words: result.correct_words,
        incorrect_words: result.incorrect_words,
      });
    },
    [targetText, fullSentence, sessionId, round, mode, onDone]
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

      {mode === "spanish_to_english" && round.spanish_prompt && (
        <p className="text-gray-400 text-sm mb-6">{round.spanish_prompt}</p>
      )}

      {mode === "missing_words" ? (
        <MissingWordsText
          content={round.content ?? ""}
          blanks={round.blanks ?? []}
          charStates={charStates}
          currentIndex={currentIndex}
        />
      ) : (
        <TypingText targetText={targetText} charStates={charStates} currentIndex={currentIndex} hidePending />
      )}

      <p className="text-gray-400 text-xs mt-6">{liveAccuracy}%</p>
    </div>
  );
}

function RoundResult({
  result,
  onNext,
  isLast,
}: {
  result: { expected: string; typed: string | null; accuracy: number; correct_words: number; incorrect_words: number };
  onNext: () => void;
  isLast: boolean;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.code === "Space" || e.key === " ") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNext]);

  return (
    <div className="py-10">
      <p className="font-mono text-lg text-white mb-1">{result.expected}</p>
      {result.typed !== null && result.typed !== result.expected && (
        <p className="font-mono text-sm text-gray-400 mb-4">Escribiste: {result.typed}</p>
      )}
      <p className="text-white text-lg mb-2 mt-6">{result.accuracy}% de precision</p>
      <p className="text-gray-400 text-sm mb-8">
        {result.correct_words} palabras correctas · {result.incorrect_words} incorrectas
      </p>
      <button
        type="button"
        onClick={onNext}
        className="bg-white text-black rounded px-4 py-2 text-sm font-medium flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none hover:bg-gray-200"
      >
        <span>{isLast ? "Terminar" : "Siguiente"}</span>
        <kbd className="text-[10px] bg-neutral-200 text-neutral-800 px-1.5 py-0.5 rounded font-mono">
          Enter ↵
        </kbd>
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
