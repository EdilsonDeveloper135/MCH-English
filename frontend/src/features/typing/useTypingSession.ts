"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ErrorInput } from "@/types";

export type CharStatus = "pending" | "correct" | "incorrect";

export interface SentenceRange {
  sentenceId: string;
  start: number;
  end: number;
}

export interface ChunkCompleteStats {
  correct_characters: number;
  incorrect_characters: number;
  total_characters: number;
  duration_seconds: number;
  errors: ErrorInput[];
}

interface TargetSentence {
  id: string;
  content: string;
}

/** Concatenates sentences into one flowing string plus each sentence's [start, end)
 * character range within it, used to render the whole thing as a single continuous
 * typing target (per the product spec: no separate boxes). Works for a text chunk's
 * sentences or an ad-hoc list (e.g. a Weak Words review session). */
export function buildTargetText(sentences: TargetSentence[]): { text: string; sentenceRanges: SentenceRange[] } {
  let text = "";
  const sentenceRanges: SentenceRange[] = [];

  sentences.forEach((sentence, i) => {
    const start = text.length;
    text += sentence.content;
    sentenceRanges.push({ sentenceId: sentence.id, start, end: text.length });
    if (i < sentences.length - 1) text += " ";
  });

  return { text, sentenceRanges };
}

function wordAtPosition(text: string, position: number): string {
  const before = text.slice(0, position + 1);
  const match = before.match(/[A-Za-z0-9']+$/);
  return match ? match[0] : "";
}

interface UseTypingSessionArgs {
  targetText: string;
  sentenceRanges: SentenceRange[];
  initialIndex?: number;
  onSentenceComplete?: (sentenceId: string, endIndex: number) => void;
  onComplete?: (stats: ChunkCompleteStats) => void;
  onWordError?: (word: string) => void;
}

export function useTypingSession({
  targetText,
  sentenceRanges,
  initialIndex = 0,
  onSentenceComplete,
  onComplete,
  onWordError,
}: UseTypingSessionArgs) {
  const clampedInitial = Math.min(Math.max(initialIndex, 0), targetText.length);

  const [charStates, setCharStates] = useState<CharStatus[]>(() => {
    const states = Array<CharStatus>(targetText.length).fill("pending");
    for (let i = 0; i < clampedInitial; i++) states[i] = "correct";
    return states;
  });
  const [currentIndex, setCurrentIndex] = useState(clampedInitial);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [errors, setErrors] = useState<ErrorInput[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const completedSentences = useRef<Set<string>>(new Set());
  const isComplete = targetText.length > 0 && currentIndex >= targetText.length;

  useEffect(() => {
    const states = Array<CharStatus>(targetText.length).fill("pending");
    for (let i = 0; i < clampedInitial; i++) states[i] = "correct";
    setCharStates(states);
    setCurrentIndex(clampedInitial);
    setCorrectCount(0);
    setIncorrectCount(0);
    setErrors([]);
    setStartedAt(null);
    completedSentences.current = new Set();
    // Only re-run when the target text itself changes (new chunk loaded).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetText]);

  useEffect(() => {
    if (!startedAt || isComplete) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt, isComplete]);

  const sentenceIdAt = useCallback(
    (position: number): string | null => {
      const range = sentenceRanges.find((r) => position >= r.start && position < r.end);
      return range ? range.sentenceId : null;
    },
    [sentenceRanges]
  );

  const checkSentenceCompletion = useCallback(
    (position: number) => {
      for (const range of sentenceRanges) {
        if (position === range.end && !completedSentences.current.has(range.sentenceId)) {
          completedSentences.current.add(range.sentenceId);
          onSentenceComplete?.(range.sentenceId, range.end);
        }
      }
    },
    [sentenceRanges, onSentenceComplete]
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (isComplete) return;

      if (e.key === "Backspace") {
        e.preventDefault();
        if (currentIndex === 0) return;
        const prevIndex = currentIndex - 1;
        setCurrentIndex(prevIndex);
        setCharStates((prev) => {
          const next = [...prev];
          next[prevIndex] = "pending";
          return next;
        });
        return;
      }

      if (e.key.length !== 1) return;
      e.preventDefault();

      const sessionStart = startedAt ?? Date.now();
      if (!startedAt) setStartedAt(sessionStart);

      const expected = targetText[currentIndex];
      const typedChar = e.key;
      const isCorrect = typedChar === expected;
      const nextIndex = currentIndex + 1;

      setCharStates((prev) => {
        const next = [...prev];
        next[currentIndex] = isCorrect ? "correct" : "incorrect";
        return next;
      });
      setCurrentIndex(nextIndex);

      let finalCorrectCount = correctCount;
      let finalIncorrectCount = incorrectCount;
      let finalErrors = errors;

      if (isCorrect) {
        finalCorrectCount = correctCount + 1;
        setCorrectCount(finalCorrectCount);
      } else {
        finalIncorrectCount = incorrectCount + 1;
        const word = wordAtPosition(targetText, currentIndex);
        finalErrors = [
          ...errors,
          {
            expected_char: expected,
            typed_char: typedChar,
            position: currentIndex,
            word,
            sentence_id: sentenceIdAt(currentIndex),
          },
        ];
        setIncorrectCount(finalIncorrectCount);
        setErrors(finalErrors);
        if (word) onWordError?.(word);
      }

      checkSentenceCompletion(nextIndex);

      if (nextIndex >= targetText.length) {
        const durationSeconds = Math.max((Date.now() - sessionStart) / 1000, 0.1);
        onComplete?.({
          correct_characters: finalCorrectCount,
          incorrect_characters: finalIncorrectCount,
          total_characters: finalCorrectCount + finalIncorrectCount,
          duration_seconds: durationSeconds,
          errors: finalErrors,
        });
      }
    },
    [
      currentIndex,
      isComplete,
      targetText,
      startedAt,
      sentenceIdAt,
      checkSentenceCompletion,
      correctCount,
      incorrectCount,
      errors,
      onComplete,
      onWordError,
    ]
  );

  const totalTyped = correctCount + incorrectCount;
  const elapsedSeconds = startedAt ? (now - startedAt) / 1000 : 0;
  const liveWpm = elapsedSeconds > 0 ? Math.round(totalTyped / 5 / (elapsedSeconds / 60)) : 0;
  const liveAccuracy = totalTyped > 0 ? Math.round((correctCount / totalTyped) * 100) : 100;

  return {
    charStates,
    currentIndex,
    isComplete,
    liveWpm,
    liveAccuracy,
    handleKeyDown,
  };
}
