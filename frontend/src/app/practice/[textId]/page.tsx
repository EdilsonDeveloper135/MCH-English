"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useTypingStore } from "@/stores/typingStore";
import { api } from "@/services/api";
import type { ChunkDTO, TextDTO, TranslationMode } from "@/types";
import type { Keystroke, PerKeyStats, SessionResult } from "@/types/typing";

// Visual engine
import { TypingDisplay } from "@/features/typing/components/TypingDisplay";
import { FluidCaret } from "@/features/typing/components/FluidCaret";
import { LiveStats } from "@/features/typing/components/LiveStats";
import { ProgressBar } from "@/features/typing/components/ProgressBar";
import { ActionBar } from "@/features/typing/components/ActionBar";
import { StreakNotification } from "@/features/typing/components/StreakNotification";
import { SmartRetry } from "@/features/typing/components/SmartRetry";
import { GhostRacer } from "@/features/typing/components/GhostRacer";
import { SessionPanel } from "@/features/typing/components/SessionPanel";
import { ZenModeExperience } from "@/features/typing/components/ZenModeExperience";
import { SessionResults } from "@/features/typing/components/SessionResults";
import { SessionReplay } from "@/features/typing/components/SessionReplay";

// Supporting learning components
import { TypingCaptureInput } from "@/features/typing/TypingCaptureInput";
import { TranslationPanel } from "@/features/typing/TranslationPanel";
import { SentenceInfoPanel } from "@/features/typing/SentenceInfoPanel";
import { WordHelpTooltip } from "@/features/typing/WordHelpTooltip";
import { ThemeSelector, useZenMode } from "@/features/typing/ZenToggle";
import { soundEngine } from "@/features/typing/audio/SoundEngine";

// Hooks
import { useFocusMode } from "@/features/typing/hooks/useFocusMode";
import { useSmartPause } from "@/features/typing/hooks/useSmartPause";
import { useStreakTracker } from "@/features/typing/hooks/useStreakTracker";

// Typing session core
import {
  buildTargetText,
  findSentenceIdAt,
  findWordStart,
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

// The worker marks a text `failed` when it cannot process it, but a killed worker
// leaves it in `processing`: stop polling instead of spinning forever.
const MAX_PROCESSING_POLLS = 80; // ~2 minutes at 1.5 s

/** Percentage of how steady the speed was, from the per-second WPM samples: 100 means
 * a perfectly even pace. Derived from real samples, not a fixed floor. */
function computeConsistency(wpmHistory: number[]): number {
  const samples = wpmHistory.filter((wpm) => wpm > 0);
  if (samples.length < 2) return 100;
  const mean = samples.reduce((sum, wpm) => sum + wpm, 0) / samples.length;
  if (mean <= 0) return 0;
  const variance = samples.reduce((sum, wpm) => sum + (wpm - mean) ** 2, 0) / samples.length;
  const spread = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(100, Math.round((1 - spread) * 100)));
}

export default function PracticePage() {
  const params = useParams<{ textId: string }>();
  const textId = params.textId;
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const preferences = useTypingStore((s) => s.preferences);
  const mergePerKeyStats = useTypingStore((s) => s.mergePerKeyStats);
  const saveGhostData = useTypingStore((s) => s.saveGhostData);
  const setStoreFocusMode = useTypingStore((s) => s.setFocusMode);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [text, setText] = useState<TextDTO | null>(null);
  const [chunk, setChunk] = useState<ChunkDTO | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { zenMode, toggleZen } = useZenMode();
  const [isSessionPanelOpen, setIsSessionPanelOpen] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [sessionCompletedResult, setSessionCompletedResult] = useState<SessionResult | null>(null);
  const [replayKeystrokes, setReplayKeystrokes] = useState<Keystroke[]>([]);

  const [translationMode, setTranslationMode] = useState<TranslationMode>("learning");
  const [lastCompletedSentenceId, setLastCompletedSentenceId] = useState<string | null>(null);
  const [revealedSentenceId, setRevealedSentenceId] = useState<string | null>(null);
  const [errorWordInfo, setErrorWordInfo] = useState<{ word: string; position: number } | null>(null);
  const [problematicRetryWord, setProblematicRetryWord] = useState<string | null>(null);

  // Per-keystroke data lives in refs: putting it in React state (or in the persisted
  // store) meant a full re-render plus a localStorage write on every character.
  const errorWordCountMap = useRef<Record<string, number>>({});
  const keystrokesRef = useRef<Keystroke[]>([]);
  const sessionKeyStatsRef = useRef<Record<string, PerKeyStats>>({});
  const lastKeyTimeRef = useRef<number>(Date.now());
  const sessionStartTimeRef = useRef<number | null>(null);
  // Mirrors of engine state, so the completion handler and the keystroke handler can
  // read the latest values without re-subscribing on every character.
  const extraCharCountRef = useRef(0);
  const charStatesRef = useRef<string[]>([]);

  const typingAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isPaused, pausedTime, handleKeystroke: handlePauseKeystroke, reset: resetPause } = useSmartPause({
    enabled: true,
    timeoutMs: 5000,
  });

  const { isFocused } = useFocusMode({
    enabled: preferences.focusModeAuto,
    keystrokeThreshold: 2,
    mouseTimeoutMs: 3000,
    typingTimeoutMs: 3000,
  });

  const { bestStreak, milestone, onWordComplete, reset: resetStreak } = useStreakTracker();

  useEffect(() => {
    if (zenMode) setStoreFocusMode(true);
  }, [zenMode, setStoreFocusMode]);

  useEffect(() => {
    soundEngine.setProfile(preferences.soundProfile);
    soundEngine.setVolume(preferences.soundVolume);
  }, [preferences.soundProfile, preferences.soundVolume]);

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

  /** Loads a specific chunk and opens a session for it. The index is explicit so
   * "retry", "skip" and "previous" do not depend on the server-side progress, which
   * only advances once a chunk is actually finished. */
  const loadChunk = useCallback(async (currentText: TextDTO, index?: number) => {
    if (currentText.has_translation && currentText.alignment_status === "needs_review") {
      setLoadState("needs-alignment");
      return;
    }
    const targetIndex = index ?? currentText.current_chunk_index;
    if (targetIndex >= currentText.chunk_count) {
      setLoadState("finished-text");
      return;
    }

    const chunkData = await api.getChunk(currentText.id, targetIndex);
    const session = await api.createSession(currentText.id, chunkData.id);
    setChunk(chunkData);
    setSessionId(session.id);
    setLoadState("ready");
    setSessionCompletedResult(null);
    setSaveError(null);
    setReplayKeystrokes([]);
    setAttempt((n) => n + 1);
    errorWordCountMap.current = {};
    keystrokesRef.current = [];
    sessionKeyStatsRef.current = {};
    sessionStartTimeRef.current = null;
    resetPause();
    resetStreak();
  }, [resetPause, resetStreak]);

  useEffect(() => {
    if (!token || !textId) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout>;
    let polls = 0;

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
          polls += 1;
          if (polls > MAX_PROCESSING_POLLS) {
            setLoadState("error");
            return;
          }
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
    const count = (errorWordCountMap.current[word] || 0) + 1;
    errorWordCountMap.current[word] = count;
    if (count >= 2) setProblematicRetryWord(word);
  }, []);

  const handleChunkComplete = useCallback(
    async (stats: ChunkCompleteStats) => {
      if (!sessionId || !text || !chunk) return;

      soundEngine.play("sessionEnd");
      mergePerKeyStats(sessionKeyStatsRef.current);
      setReplayKeystrokes(keystrokesRef.current.slice());

      let finished;
      try {
        finished = await api.finishSession(sessionId, stats);
      } catch {
        // Without this the finished session vanished silently on a network hiccup.
        setSaveError("No se pudo guardar la sesion. Revisa tu conexion e intenta de nuevo.");
        return;
      }
      setSaveError(null);

      const errorWords = Array.from(
        new Set(
          stats.errors
            .map((err) => wordAtPosition(targetText, err.position))
            .filter((w): w is string => Boolean(w && w.length > 0))
        )
      );

      const durationExcludingPauses = Math.max(0.1, stats.duration_seconds - pausedTime / 1000);
      const rawWpm = Math.round((stats.total_characters / 5) / (durationExcludingPauses / 60));
      const wpmHistory = stats.wpmHistory ?? [];

      // Real per-key numbers collected during this session, not placeholders.
      const problematicKeys = Object.values(sessionKeyStatsRef.current)
        .filter((keyStats) => keyStats.errors > 0)
        .sort((a, b) => b.errors - a.errors)
        .slice(0, 5)
        .map((keyStats) => ({
          key: keyStats.key === " " ? "space" : keyStats.key,
          accuracy: Math.round((keyStats.correct / Math.max(1, keyStats.count)) * 100),
          count: keyStats.count,
        }));

      setSessionCompletedResult({
        wpm: finished.wpm,
        rawWpm,
        accuracy: finished.accuracy,
        consistency: computeConsistency(wpmHistory),
        errors: stats.incorrect_characters,
        duration: durationExcludingPauses,
        characters: {
          correct: stats.correct_characters,
          incorrect: stats.incorrect_characters,
          extra: extraCharCountRef.current,
          total: stats.total_characters,
        },
        bestStreak,
        problematicWords: errorWords.map((w) => ({ word: w, errors: errorWordCountMap.current[w] || 1 })),
        problematicKeys,
        wpmOverTime: wpmHistory.map((wpm, index) => ({ time: index + 1, wpm })),
      });

      const startedAt = sessionStartTimeRef.current;
      saveGhostData({
        textId: text.id,
        chunkIndex: chunk.index,
        finalWpm: finished.wpm,
        totalChars: targetText.length,
        keystrokePositions: keystrokesRef.current.map((k) => ({
          time: k.timestamp - (startedAt ?? k.timestamp),
          charIndex: k.charIndex,
          progress: (k.charIndex / (targetText.length || 1)) * 100,
        })),
      });

      try {
        const updatedText = await api.updateProgress(text.id, chunk.index + 1, 0);
        setText(updatedText);
      } catch {
        // Progress is a convenience; the session itself is already saved.
      }
    },
    [sessionId, text, chunk, targetText, pausedTime, bestStreak, mergePerKeyStats, saveGhostData]
  );

  const initialIndex = text && chunk && text.current_chunk_index === chunk.index ? text.current_character_index : 0;

  const { charStates, currentIndex, extraChars, handleKeyDown: rawKeyDown, handleInput: rawInput, liveWpm, liveAccuracy } =
    useTypingSession({
      targetText,
      sentenceRanges,
      initialIndex,
      resetKey: attempt,
      onSentenceComplete: handleSentenceComplete,
      onComplete: handleChunkComplete,
      onWordError: handleWordError,
    });

  extraCharCountRef.current = Object.values(extraChars).reduce((total, chars) => total + chars.length, 0);
  charStatesRef.current = charStates;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      handlePauseKeystroke();
      const now = Date.now();
      if (!sessionStartTimeRef.current) sessionStartTimeRef.current = now;

      const reactionMs = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      const expected = targetText[currentIndex];
      // `expected` is undefined once the exercise is complete -- a stray keystroke
      // while the session is being saved used to throw here.
      if (expected !== undefined && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const isCorrect = e.key === expected;

        if (expected === " ") {
          // A word only counts for the streak if every character in it was correct;
          // this used to count any space as a perfect word.
          const wordStart = findWordStart(targetText, currentIndex - 1);
          const typedWord = charStatesRef.current.slice(wordStart, currentIndex);
          onWordComplete(isCorrect && typedWord.every((state) => state === "correct"));
        }

        keystrokesRef.current.push({ key: e.key, timestamp: now, correct: isCorrect, charIndex: currentIndex });

        const keyName = expected.toLowerCase();
        const current = sessionKeyStatsRef.current[keyName] ?? {
          key: keyName,
          errors: 0,
          correct: 0,
          totalReactionMs: 0,
          count: 0,
        };
        sessionKeyStatsRef.current[keyName] = {
          ...current,
          errors: current.errors + (isCorrect ? 0 : 1),
          correct: current.correct + (isCorrect ? 1 : 0),
          totalReactionMs: current.totalReactionMs + reactionMs,
          count: current.count + 1,
        };
      }

      rawKeyDown(e);
    },
    [handlePauseKeystroke, targetText, currentIndex, onWordComplete, rawKeyDown]
  );

  const handleInput = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      handlePauseKeystroke();
      rawInput(e);
    },
    [handlePauseKeystroke, rawInput]
  );

  useEffect(() => {
    inputRef.current?.focus();
    setLastCompletedSentenceId(null);
    setRevealedSentenceId(null);
  }, [chunk?.id, attempt]);

  function handleModeChange(mode: TranslationMode) {
    setTranslationMode(mode);
    api.updateSettings({ translation_mode: mode }).catch(() => {});
  }

  function updateSentenceInChunk(sentenceId: string, update: (s: ChunkDTO["sentences"][number]) => ChunkDTO["sentences"][number]) {
    setChunk((prev) =>
      prev ? { ...prev, sentences: prev.sentences.map((s) => (s.id === sentenceId ? update(s) : s)) } : prev
    );
  }

  const retryCurrentChunk = useCallback(() => {
    if (text && chunk) loadChunk(text, chunk.index);
  }, [text, chunk, loadChunk]);

  const goToChunk = useCallback(
    (index: number) => {
      if (text) loadChunk(text, index);
    },
    [text, loadChunk]
  );

  if (loadState === "loading") return <CenteredMessage text="Cargando texto de práctica..." />;
  if (loadState === "processing") return <CenteredMessage text="Procesando oraciones y alineación..." />;
  if (loadState === "error") {
    return (
      <CenteredMessage text="No se pudo cargar el texto para practicar.">
        <button
          onClick={() => router.push("/library")}
          className="mt-4 bg-[var(--accent)] text-black px-6 py-2 rounded-xl text-sm font-semibold hover:opacity-90"
        >
          Volver a la biblioteca
        </button>
      </CenteredMessage>
    );
  }
  if (loadState === "failed") {
    return <CenteredMessage text={`Error al procesar el texto: ${text?.error_message ?? "desconocido"}`} />;
  }
  if (loadState === "finished-text") {
    return (
      <CenteredMessage text="¡Felicitaciones! Has completado todos los fragmentos de este texto.">
        <button
          onClick={() => router.push("/library")}
          className="mt-4 bg-[var(--accent)] text-black px-6 py-2 rounded-xl text-sm font-semibold hover:opacity-90"
        >
          Volver a la biblioteca
        </button>
      </CenteredMessage>
    );
  }
  if (loadState === "needs-alignment") {
    return (
      <CenteredMessage text="Revisa la alineación de la traducción antes de practicar este texto.">
        <button
          onClick={() => router.push(`/library/${textId}/align`)}
          className="mt-4 underline text-sm text-[var(--accent)]"
        >
          Revisar alineación
        </button>
      </CenteredMessage>
    );
  }

  const progressPercent = targetText.length ? (currentIndex / targetText.length) * 100 : 0;
  const isComplete = targetText.length > 0 && currentIndex >= targetText.length;
  const elapsedSeconds = sessionStartTimeRef.current
    ? (Date.now() - sessionStartTimeRef.current - pausedTime) / 1000
    : 0;

  const currentSentenceId = findSentenceIdAt(sentenceRanges, currentIndex);
  const targetSentenceId =
    translationMode === "assisted" ? currentSentenceId ?? lastCompletedSentenceId : lastCompletedSentenceId;
  const targetSentence = chunk?.sentences.find((s) => s.id === targetSentenceId) ?? null;
  const isRevealed = targetSentenceId !== null && targetSentenceId === revealedSentenceId;
  const hasNextChunk = Boolean(text && chunk && chunk.index + 1 < text.chunk_count);

  if (zenMode) {
    return (
      <>
        <TypingCaptureInput inputRef={inputRef} onKeyDown={handleKeyDown} onInput={handleInput} />
        <ZenModeExperience
          targetText={targetText}
          charStates={charStates}
          currentIndex={currentIndex}
          extraChars={extraChars}
          onExit={toggleZen}
        />
      </>
    );
  }

  if (isReplaying && sessionCompletedResult) {
    return (
      <SessionReplay
        targetText={targetText}
        keystrokes={replayKeystrokes}
        onClose={() => setIsReplaying(false)}
      />
    );
  }

  if (sessionCompletedResult) {
    return (
      <div className="min-h-screen px-6 py-12 flex flex-col justify-center">
        <SessionResults
          result={sessionCompletedResult}
          onAgain={retryCurrentChunk}
          onNext={hasNextChunk && chunk ? () => goToChunk(chunk.index + 1) : undefined}
          onQuickPractice={() => router.push("/practice/weak-words")}
          onReplay={replayKeystrokes.length > 0 ? () => setIsReplaying(true) : undefined}
          onBackToLibrary={() => router.push("/library")}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-start md:justify-center px-4 md:px-6 pt-4 md:pt-0 relative">
      <ProgressBar percent={progressPercent} />

      <TypingCaptureInput inputRef={inputRef} onKeyDown={handleKeyDown} onInput={handleInput} />

      <StreakNotification milestone={milestone} />

      <div className="w-full max-w-3xl cursor-text relative select-none" onClick={() => inputRef.current?.focus()}>
        {text && chunk && (
          <GhostRacer
            currentProgress={progressPercent}
            textId={text.id}
            chunkIndex={chunk.index}
            elapsedMs={sessionStartTimeRef.current ? Date.now() - sessionStartTimeRef.current : 0}
          />
        )}

        <div
          className={`flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-neutral-900 text-xs transition-opacity duration-300 ${
            isFocused ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <p className="text-neutral-400">
            {text?.title ? <span className="text-white font-medium">{text.title}</span> : ""}
            {chunk && text ? (
              <span className="text-neutral-500"> · Fragmento {chunk.index + 1}/{text.chunk_count}</span>
            ) : (
              ""
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleZen}
              className="text-xs px-2.5 py-1 rounded-md border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
            >
              🧘 Zen
            </button>
            <ThemeSelector />
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <LiveStats
            wpm={liveWpm}
            accuracy={liveAccuracy}
            errors={charStates.filter((s) => s === "incorrect").length}
            elapsedSeconds={Math.max(0, Math.round(elapsedSeconds))}
            progressPercent={progressPercent}
            isFocused={isFocused}
          />

          <div
            className={`flex gap-1 text-xs transition-opacity duration-300 ${
              isFocused ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => handleModeChange(m.value)}
                className={`px-2 py-1 rounded transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                  translationMode === m.value
                    ? "bg-white text-black font-medium"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {saveError && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            <span>{saveError}</span>
            <button
              type="button"
              onClick={retryCurrentChunk}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
            >
              Reintentar fragmento
            </button>
          </div>
        )}

        <div className="relative my-6" ref={typingAreaRef}>
          <FluidCaret containerRef={typingAreaRef} currentIndex={currentIndex} isComplete={isComplete} />
          <TypingDisplay
            targetText={targetText}
            charStates={charStates}
            currentIndex={currentIndex}
            extraChars={extraChars}
          />
        </div>

        <div
          className={`transition-opacity duration-300 ${
            isFocused ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
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
              onGrammarNoteSaved={(sId, note) => updateSentenceInChunk(sId, (s) => ({ ...s, grammar_note: note }))}
              onPhraseAdded={(sId, phrase) => updateSentenceInChunk(sId, (s) => ({ ...s, phrases: [...s.phrases, phrase] }))}
              onPhraseDeleted={(sId, pId) => updateSentenceInChunk(sId, (s) => ({ ...s, phrases: s.phrases.filter((p) => p.id !== pId) }))}
            />
          )}
        </div>
      </div>

      <WordHelpTooltip word={errorWordInfo?.word ?? null} activeCharIndex={errorWordInfo?.position} />

      <SmartRetry
        problematicWord={problematicRetryWord}
        onStartPractice={(word) => {
          setProblematicRetryWord(null);
          router.push(`/practice/weak-words?word=${encodeURIComponent(word)}`);
        }}
        onDismiss={() => setProblematicRetryWord(null)}
      />

      <ActionBar
        onRetry={retryCurrentChunk}
        onSkip={hasNextChunk && chunk ? () => goToChunk(chunk.index + 1) : undefined}
        onPrevious={chunk && chunk.index > 0 ? () => goToChunk(chunk.index - 1) : undefined}
        onEnd={() => router.push("/library")}
        onSettings={() => setIsSessionPanelOpen(true)}
        isFocused={isFocused}
        isPaused={isPaused}
      />

      <SessionPanel isOpen={isSessionPanelOpen} onClose={() => setIsSessionPanelOpen(false)} />
    </div>
  );
}

function CenteredMessage({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <p className="text-neutral-400 text-sm font-mono">{text}</p>
      {children}
    </div>
  );
}
