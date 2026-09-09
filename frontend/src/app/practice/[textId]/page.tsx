"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import type { ChunkDTO, TextDTO } from "@/types";
import { TypingText } from "@/features/typing/TypingText";
import { TypingStats } from "@/features/typing/TypingStats";
import { TranslationPanel } from "@/features/typing/TranslationPanel";
import { WordHelpTooltip } from "@/features/typing/WordHelpTooltip";
import { buildTargetText, useTypingSession, type ChunkCompleteStats } from "@/features/typing/useTypingSession";

type LoadState =
  | "loading"
  | "processing"
  | "ready"
  | "failed"
  | "finished-text"
  | "needs-alignment"
  | "error";

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
  const [lastTranslation, setLastTranslation] = useState<string | null>(null);
  const [errorWord, setErrorWord] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

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
      const sentence = chunk.sentences.find((s) => s.id === sentenceId);
      setLastTranslation(sentence?.translation ?? null);
      api.updateProgress(text.id, chunk.index, endIndex).catch(() => {});
    },
    [text, chunk]
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
    setLastTranslation(null);
  }, [chunk]);

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
        <TypingStats wpm={liveWpm} accuracy={liveAccuracy} progressPercent={progressPercent} />

        {isChunkDone && chunkSummary ? (
          <ChunkCompleteSummary
            wpm={chunkSummary.wpm}
            accuracy={chunkSummary.accuracy}
            onContinue={() => window.location.reload()}
          />
        ) : (
          <>
            <TypingText targetText={targetText} charStates={charStates} currentIndex={currentIndex} />
            <TranslationPanel translation={lastTranslation} />
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
