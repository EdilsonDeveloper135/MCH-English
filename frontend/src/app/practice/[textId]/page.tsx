"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import type { ChunkDTO, PhraseDTO, TextDTO, TranslationMode } from "@/types";
import { TypingText } from "@/features/typing/TypingText";
import { TypingCaptureInput } from "@/features/typing/TypingCaptureInput";
import { TypingStats } from "@/features/typing/TypingStats";
import { TranslationPanel } from "@/features/typing/TranslationPanel";
import { SentenceInfoPanel } from "@/features/typing/SentenceInfoPanel";
import { WordHelpTooltip } from "@/features/typing/WordHelpTooltip";
import { SessionSummaryModal } from "@/features/typing/SessionSummaryModal";
import { ZenToggle, ThemeSelector, useZenMode } from "@/features/typing/ZenToggle";
import { AudioFeedbackSettings } from "@/features/typing/AudioFeedbackSettings";
import {
  buildTargetText,
  findSentenceIdAt,
  useTypingSession,
  wordAtPosition,
  type ChunkCompleteStats,
} from "@/features/typing/useTypingSession";

type LoadState =
  | "loading"
  | "processing"
  | "ready"
  | "failed"
  | "finished-text"
  | "needs-alignment"
  | "error";

const MODES: { value: TranslationMode; label: string }[] = [
  { value: "learning", label: "Learning" },
  { value: "immersion", label: "Immersion" },
  { value: "assisted", label: "Assisted" },
];

export default function PracticePage() {
  const params = useParams<{ textId: string }>();
  const textId = params.textId;
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [text, setText] = useState<TextDTO | null>(null);
  const [chunk, setChunk] = useState<ChunkDTO | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { zenMode, toggleZen } = useZenMode();
  const [chunkSummary, setChunkSummary] = useState<{
    wpm: number;
    accuracy: number;
    durationSeconds: number;
    wpmHistory: number[];
    failedWords: string[];
  } | null>(null);
  const [translationMode, setTranslationMode] = useState<TranslationMode>("learning");
  const [lastCompletedSentenceId, setLastCompletedSentenceId] = useState<string | null>(null);
  const [revealedSentenceId, setRevealedSentenceId] = useState<string | null>(null);
  const [errorWordInfo, setErrorWordInfo] = useState<{ word: string; position: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  useEffect(() => {
    if (!hasHydrated || !token) return;
    api
      .getSettings()
      .then((s) => setTranslationMode(s.translation_mode))
      .catch(() => {});
  }, [hasHydrated, token]);

  const loadChunk = useCallback(async (currentText: TextDTO) => {
    if (currentText.has_translation && currentText.alignment_status === "needs_review") {
      setLoadState("needs-alignment");
      return;
    }
    if (currentText.current_chunk_index >= currentText.chunk_count) {
      setLoadState("finished-text");
      return;
    }
    const chunkData = await api.getChunk(currentText.id, currentText.current_chunk_index);
    const session = await api.createSession(currentText.id, chunkData.id);
    setChunk(chunkData);
    setSessionId(session.id);
    setLoadState("ready");
  }, []);

  useEffect(() => {
    if (!token || !textId) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const t = await api.getText(textId);
        if (cancelled) return;
        setText(t);

        if (t.status === "failed") {
          setLoadState("failed");
          return;
        }
        if (t.status !== "ready") {
          setLoadState("processing");
          pollTimer = setTimeout(poll, 1500);
          return;
        }
        await loadChunk(t);
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
    };
  }, [token, textId, loadChunk]);

  const { text: targetText, sentenceRanges } = chunk
    ? buildTargetText(chunk.sentences)
    : { text: "", sentenceRanges: [] };

  const handleSentenceComplete = useCallback(
    (sentenceId: string, endIndex: number) => {
      if (!text || !chunk) return;
      setLastCompletedSentenceId(sentenceId);
      if (translationMode === "learning") setRevealedSentenceId(sentenceId);
      api.updateProgress(text.id, chunk.index, endIndex).catch(() => {});
    },
    [text, chunk, translationMode]
  );

  const handleWordError = useCallback((word: string, position: number) => {
    setErrorWordInfo({ word, position });
  }, []);

  const handleChunkComplete = useCallback(
    async (stats: ChunkCompleteStats) => {
      if (!sessionId || !text || !chunk) return;
      const finished = await api.finishSession(sessionId, stats);

      const errorWords = Array.from(
        new Set(
          stats.errors
            .map((err) => wordAtPosition(targetText, err.position))
            .filter((w): w is string => Boolean(w && w.length > 0))
        )
      );

      setChunkSummary({
        wpm: finished.wpm,
        accuracy: finished.accuracy,
        durationSeconds: stats.duration_seconds,
        wpmHistory: stats.wpmHistory ?? [finished.wpm],
        failedWords: errorWords,
      });

      const updatedText = await api.updateProgress(text.id, chunk.index + 1, 0);
      setText(updatedText);
    },
    [sessionId, text, chunk, targetText]
  );

  const handleContinue = useCallback(() => {
    setChunkSummary(null);
    setSessionId(null);
    if (text) loadChunk(text);
  }, [text, loadChunk]);

  const initialIndex = text && chunk && text.current_chunk_index === chunk.index ? text.current_character_index : 0;

  const { charStates, currentIndex, extraChars, handleKeyDown, handleInput, liveWpm, liveAccuracy } = useTypingSession({
    targetText,
    sentenceRanges,
    initialIndex,
    onSentenceComplete: handleSentenceComplete,
    onComplete: handleChunkComplete,
    onWordError: handleWordError,
  });

  useEffect(() => {
    inputRef.current?.focus();
    setLastCompletedSentenceId(null);
    setRevealedSentenceId(null);
    // Only reset when a genuinely new chunk loads -- `chunk`'s object identity also
    // changes on local optimistic updates (grammar note / phrase edits), which must
    // NOT wipe the currently-revealed/targeted sentence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunk?.id]);

  function handleModeChange(mode: TranslationMode) {
    setTranslationMode(mode);
    api.updateSettings({ translation_mode: mode }).catch(() => {});
  }

  function updateSentenceInChunk(sentenceId: string, update: (s: ChunkDTO["sentences"][number]) => ChunkDTO["sentences"][number]) {
    setChunk((prev) =>
      prev ? { ...prev, sentences: prev.sentences.map((s) => (s.id === sentenceId ? update(s) : s)) } : prev
    );
  }

  function handleGrammarNoteSaved(sentenceId: string, note: string | null) {
    updateSentenceInChunk(sentenceId, (s) => ({ ...s, grammar_note: note }));
  }

  function handlePhraseAdded(sentenceId: string, phrase: PhraseDTO) {
    updateSentenceInChunk(sentenceId, (s) => ({ ...s, phrases: [...s.phrases, phrase] }));
  }

  function handlePhraseDeleted(sentenceId: string, phraseId: string) {
    updateSentenceInChunk(sentenceId, (s) => ({ ...s, phrases: s.phrases.filter((p) => p.id !== phraseId) }));
  }

  if (loadState === "loading") return <CenteredMessage text="Cargando..." />;
  if (loadState === "processing") return <CenteredMessage text="Procesando texto..." />;
  if (loadState === "error") return <CenteredMessage text="No se pudo cargar el texto." />;
  if (loadState === "failed") {
    return <CenteredMessage text={`Error al procesar el texto: ${text?.error_message ?? "desconocido"}`} />;
  }
  if (loadState === "finished-text") {
    return (
      <CenteredMessage text="Ya completaste este texto.">
        <button onClick={() => router.push("/library")} className="mt-4 underline text-sm">
          Volver a la biblioteca
        </button>
      </CenteredMessage>
    );
  }
  if (loadState === "needs-alignment") {
    return (
      <CenteredMessage text="Revisa la alineacion de la traduccion antes de practicar este texto.">
        <button
          onClick={() => router.push(`/library/${textId}/align`)}
          className="mt-4 underline text-sm"
        >
          Revisar alineacion
        </button>
      </CenteredMessage>
    );
  }

  const progressPercent = targetText.length ? (currentIndex / targetText.length) * 100 : 0;

  const currentSentenceId = findSentenceIdAt(sentenceRanges, currentIndex);
  const targetSentenceId =
    translationMode === "assisted" ? currentSentenceId ?? lastCompletedSentenceId : lastCompletedSentenceId;
  const targetSentence = chunk?.sentences.find((s) => s.id === targetSentenceId) ?? null;
  const isRevealed = targetSentenceId !== null && targetSentenceId === revealedSentenceId;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-start md:justify-center px-4 md:px-6 pt-4 md:pt-0">
      <TypingCaptureInput inputRef={inputRef} onKeyDown={handleKeyDown} onInput={handleInput} />

      <div className="w-full max-w-3xl cursor-text" onClick={() => inputRef.current?.focus()}>
        {/* Book Context & Quick Controls Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-neutral-900 text-xs">
          <p className="text-gray-400">
            {text?.title ? <span className="text-white font-medium">{text.title}</span> : ""}
            {chunk && text ? (
              <span className="text-gray-500"> · Fragmento {chunk.index + 1}/{text.chunk_count}</span>
            ) : (
              ""
            )}
          </p>
          <div className="flex items-center gap-2">
            <ZenToggle zenMode={zenMode} onToggle={toggleZen} />
            <ThemeSelector />
            <AudioFeedbackSettings />
          </div>
        </div>

        {/* Live Typing Metrics & Translation Mode */}
        <div
          className={`flex items-center justify-between mb-2 transition-opacity duration-300 ${
            zenMode ? "opacity-0 hover:opacity-100" : ""
          }`}
        >
          <TypingStats wpm={liveWpm} accuracy={liveAccuracy} progressPercent={progressPercent} />
          <div className="flex gap-1 text-xs">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => handleModeChange(m.value)}
                className={`px-2 py-1 rounded transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                  translationMode === m.value
                    ? "bg-white text-black font-medium"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <TypingText
          targetText={targetText}
          charStates={charStates}
          currentIndex={currentIndex}
          extraChars={extraChars}
        />

        <div className={zenMode ? "opacity-0 hover:opacity-100 transition-opacity duration-300" : ""}>
          <TranslationPanel
            translation={targetSentence?.translation ?? null}
            mode={translationMode}
            revealed={isRevealed}
            onReveal={() => targetSentenceId && setRevealedSentenceId(targetSentenceId)}
          />
          {targetSentence && (
            <SentenceInfoPanel
              textId={textId}
              sentence={targetSentence}
              onGrammarNoteSaved={handleGrammarNoteSaved}
              onPhraseAdded={handlePhraseAdded}
              onPhraseDeleted={handlePhraseDeleted}
            />
          )}
        </div>
      </div>

      <WordHelpTooltip word={errorWordInfo?.word ?? null} activeCharIndex={errorWordInfo?.position} />

      {chunkSummary && (
        <SessionSummaryModal
          wpm={chunkSummary.wpm}
          accuracy={chunkSummary.accuracy}
          durationSeconds={chunkSummary.durationSeconds}
          wpmHistory={chunkSummary.wpmHistory}
          failedWords={chunkSummary.failedWords}
          onContinue={handleContinue}
        />
      )}
    </div>
  );
}

function CenteredMessage({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="text-gray-400 text-sm">{text}</p>
      {children}
    </div>
  );
}
