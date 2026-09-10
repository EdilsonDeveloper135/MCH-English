"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import type { ChunkDTO, PhraseDTO, TextDTO, TranslationMode } from "@/types";
import { TypingText } from "@/features/typing/TypingText";
import { TypingStats } from "@/features/typing/TypingStats";
import { TranslationPanel } from "@/features/typing/TranslationPanel";
import { SentenceInfoPanel } from "@/features/typing/SentenceInfoPanel";
import { WordHelpTooltip } from "@/features/typing/WordHelpTooltip";
import {
  buildTargetText,
  findSentenceIdAt,
  useTypingSession,
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
  const [chunkSummary, setChunkSummary] = useState<{ wpm: number; accuracy: number } | null>(null);
  const [translationMode, setTranslationMode] = useState<TranslationMode>("learning");
  const [lastCompletedSentenceId, setLastCompletedSentenceId] = useState<string | null>(null);
  const [revealedSentenceId, setRevealedSentenceId] = useState<string | null>(null);
  const [errorWord, setErrorWord] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  useEffect(() => {
    if (!hasHydrated || !token) return;
    api.getSettings().then((s) => setTranslationMode(s.translation_mode));
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

  const handleWordError = useCallback((word: string) => {
    setErrorWord(word);
  }, []);

  const handleChunkComplete = useCallback(
    async (stats: ChunkCompleteStats) => {
      if (!sessionId || !text || !chunk) return;
      const finished = await api.finishSession(sessionId, stats);
      setChunkSummary({ wpm: finished.wpm, accuracy: finished.accuracy });
      await api.updateProgress(text.id, chunk.index + 1, 0);
    },
    [sessionId, text, chunk]
  );

  const initialIndex = text && chunk && text.current_chunk_index === chunk.index ? text.current_character_index : 0;

  const { charStates, currentIndex, handleKeyDown, liveWpm, liveAccuracy } = useTypingSession({
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
  const isChunkDone = currentIndex >= targetText.length && targetText.length > 0;

  const currentSentenceId = findSentenceIdAt(sentenceRanges, currentIndex);
  const targetSentenceId =
    translationMode === "assisted" ? currentSentenceId ?? lastCompletedSentenceId : lastCompletedSentenceId;
  const targetSentence = chunk?.sentences.find((s) => s.id === targetSentenceId) ?? null;
  const isRevealed = targetSentenceId !== null && targetSentenceId === revealedSentenceId;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <input
        ref={inputRef}
        className="opacity-0 absolute h-0 w-0 pointer-events-none"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          e.target.value = "";
        }}
        onBlur={() => inputRef.current?.focus()}
      />

      <div className="w-full max-w-3xl cursor-text" onClick={() => inputRef.current?.focus()}>
        <div className="flex items-center justify-between mb-2">
          <TypingStats wpm={liveWpm} accuracy={liveAccuracy} progressPercent={progressPercent} />
          <div className="flex gap-1 text-xs">
            {MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => handleModeChange(m.value)}
                className={
                  translationMode === m.value
                    ? "bg-white text-black rounded px-2 py-1"
                    : "text-gray-500 hover:text-white px-2 py-1"
                }
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {isChunkDone && chunkSummary ? (
          <ChunkCompleteSummary
            wpm={chunkSummary.wpm}
            accuracy={chunkSummary.accuracy}
            onContinue={() => window.location.reload()}
          />
        ) : (
          <>
            <TypingText targetText={targetText} charStates={charStates} currentIndex={currentIndex} />
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
          </>
        )}
      </div>

      <WordHelpTooltip word={errorWord} />
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

function ChunkCompleteSummary({
  wpm,
  accuracy,
  onContinue,
}: {
  wpm: number;
  accuracy: number;
  onContinue: () => void;
}) {
  return (
    <div className="text-center py-16">
      <p className="text-white text-lg mb-2">Fragmento completado</p>
      <p className="text-gray-400 text-sm mb-8">
        {wpm} WPM · {accuracy}% precision
      </p>
      <button onClick={onContinue} className="bg-white text-black rounded px-4 py-2 text-sm font-medium">
        Continuar
      </button>
    </div>
  );
}
