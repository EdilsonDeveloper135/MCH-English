"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent as ReactFormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { ErrorInput } from "@/types";
import { soundEngine } from "./audio/SoundEngine";

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
  /** Final per-character correctness, in case a caller needs to reconstruct what was
   * actually typed (e.g. Recall attempts) instead of just the aggregate counts. */
  finalCharStates: CharStatus[];
  wpmHistory?: number[];
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

/** Finds which sentence range a character position falls in (used to attribute a
 * typing error to a sentence, and to know which sentence is currently being typed
 * for Assisted-mode translation reveal). */
export function findSentenceIdAt(sentenceRanges: SentenceRange[], position: number): string | null {
  const range = sentenceRanges.find((r) => position >= r.start && position < r.end);
  return range ? range.sentenceId : null;
}

/** Extracts the full word surrounding `position` by expanding bidirectionally. */
export function wordAtPosition(text: string, position: number): string {
  if (position < 0 || position >= text.length) return "";
  const isWordChar = (c: string) => /[\p{L}\p{N}'’-]/u.test(c);

  let pos = position;
  if (!isWordChar(text[pos])) {
    if (pos > 0 && isWordChar(text[pos - 1])) {
      pos = pos - 1;
    } else {
      return "";
    }
  }

  let start = pos;
  while (start > 0 && isWordChar(text[start - 1])) {
    start--;
  }

  let end = pos + 1;
  while (end < text.length && isWordChar(text[end])) {
    end++;
  }

  return text.slice(start, end).replace(/^-+|-+$/g, "");
}

/** Finds the start index of the word containing or preceding `position`. */
export function findWordStart(text: string, position: number): number {
  if (position <= 0) return 0;
  const isWordChar = (c: string) => /[\p{L}\p{N}'’-]/u.test(c);
  let pos = Math.min(position, text.length - 1);

  // If currently on whitespace/punctuation, skip backwards to word chars
  while (pos > 0 && !isWordChar(text[pos])) {
    pos--;
  }
  // Then find the beginning of this word
  while (pos > 0 && isWordChar(text[pos - 1])) {
    pos--;
  }
  return pos;
}

interface UseTypingSessionArgs {
  targetText: string;
  sentenceRanges: SentenceRange[];
  initialIndex?: number;
  /** Changing this restarts the exercise even when `targetText` is identical -- what
   * "retry this same chunk" needs, since the reset is otherwise keyed on the text. */
  resetKey?: string | number;
  onSentenceComplete?: (sentenceId: string, endIndex: number) => void;
  onComplete?: (stats: ChunkCompleteStats) => void;
  onWordError?: (word: string, position: number) => void;
}

export function useTypingSession({
  targetText,
  sentenceRanges,
  initialIndex = 0,
  resetKey,
  onSentenceComplete,
  onComplete,
  onWordError,
}: UseTypingSessionArgs) {
  const clampedInitial = Math.min(Math.max(initialIndex, 0), targetText.length);

  // Mutable refs for high-frequency state to avoid stale closure race conditions at >100 WPM
  const currentIndexRef = useRef(clampedInitial);
  const charStatesRef = useRef<CharStatus[]>([]);
  const correctCountRef = useRef(0);
  const incorrectCountRef = useRef(0);
  const errorsRef = useRef<ErrorInput[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const extraCharsRef = useRef<Record<number, string[]>>({});
  const completedSentences = useRef<Set<string>>(new Set());
  const wpmHistoryRef = useRef<number[]>([]);

  // Initialize refs
  if (charStatesRef.current.length !== targetText.length) {
    const states = Array<CharStatus>(targetText.length).fill("pending");
    for (let i = 0; i < clampedInitial; i++) states[i] = "correct";
    charStatesRef.current = states;
  }

  // React state for UI rendering
  const [charStates, setCharStates] = useState<CharStatus[]>(() => charStatesRef.current);
  const [currentIndex, setCurrentIndex] = useState(clampedInitial);
  const [extraChars, setExtraChars] = useState<Record<number, string[]>>({});
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [, setErrors] = useState<ErrorInput[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const isComplete = targetText.length > 0 && currentIndex >= targetText.length;

  useEffect(() => {
    const states = Array<CharStatus>(targetText.length).fill("pending");
    for (let i = 0; i < clampedInitial; i++) states[i] = "correct";

    charStatesRef.current = states;
    currentIndexRef.current = clampedInitial;
    correctCountRef.current = 0;
    incorrectCountRef.current = 0;
    errorsRef.current = [];
    startedAtRef.current = null;
    extraCharsRef.current = {};
    completedSentences.current = new Set();
    wpmHistoryRef.current = [];

    setCharStates(states);
    setCurrentIndex(clampedInitial);
    setExtraChars({});
    setCorrectCount(0);
    setIncorrectCount(0);
    setErrors([]);
    setStartedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetText, resetKey]);

  useEffect(() => {
    if (!startedAt || isComplete) return;
    const interval = setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);
      const total = correctCountRef.current + incorrectCountRef.current;
      const elapsed = (currentNow - startedAt) / 1000;
      if (elapsed > 0) {
        const wpm = Math.round(total / 5 / (elapsed / 60));
        wpmHistoryRef.current.push(wpm);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt, isComplete]);

  const sentenceIdAt = useCallback((position: number) => findSentenceIdAt(sentenceRanges, position), [sentenceRanges]);

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

  const applyBackspace = useCallback(() => {
    const idx = currentIndexRef.current;
    const wordStart = findWordStart(targetText, Math.max(0, idx - 1));
    const extras = extraCharsRef.current[wordStart];

    // Pop extra characters first if any exist
    if (extras && extras.length > 0) {
      const nextExtras = extras.slice(0, -1);
      if (nextExtras.length === 0) {
        const { [wordStart]: _, ...rest } = extraCharsRef.current;
        extraCharsRef.current = rest;
      } else {
        extraCharsRef.current = { ...extraCharsRef.current, [wordStart]: nextExtras };
      }
      setExtraChars({ ...extraCharsRef.current });
      incorrectCountRef.current = Math.max(0, incorrectCountRef.current - 1);
      setIncorrectCount(incorrectCountRef.current);
      if (errorsRef.current.length > 0) {
        errorsRef.current.pop();
        setErrors([...errorsRef.current]);
      }
      return;
    }

    if (idx === 0) return;
    const prevIndex = idx - 1;
    const prevState = charStatesRef.current[prevIndex];

    charStatesRef.current[prevIndex] = "pending";
    currentIndexRef.current = prevIndex;

    if (prevState === "correct") {
      correctCountRef.current = Math.max(0, correctCountRef.current - 1);
    } else if (prevState === "incorrect") {
      incorrectCountRef.current = Math.max(0, incorrectCountRef.current - 1);
      const lastMatch = errorsRef.current.map((err) => err.position).lastIndexOf(prevIndex);
      if (lastMatch !== -1) {
        errorsRef.current = [
          ...errorsRef.current.slice(0, lastMatch),
          ...errorsRef.current.slice(lastMatch + 1),
        ];
      }
    }

    setCurrentIndex(prevIndex);
    setCharStates([...charStatesRef.current]);
    setCorrectCount(correctCountRef.current);
    setIncorrectCount(incorrectCountRef.current);
    setErrors([...errorsRef.current]);
  }, [targetText]);

  const applyWordBackspace = useCallback(() => {
    const idx = currentIndexRef.current;
    if (idx === 0) return;

    // Clear extra characters for current word
    const wordStart = findWordStart(targetText, Math.max(0, idx - 1));
    const extrasCount = extraCharsRef.current[wordStart]?.length ?? 0;
    if (extrasCount > 0) {
      const { [wordStart]: _, ...rest } = extraCharsRef.current;
      extraCharsRef.current = rest;
      setExtraChars({ ...extraCharsRef.current });
      incorrectCountRef.current = Math.max(0, incorrectCountRef.current - extrasCount);
      for (let k = 0; k < extrasCount && errorsRef.current.length > 0; k++) {
        errorsRef.current.pop();
      }
    }

    const targetIndex = findWordStart(targetText, idx - 1);

    for (let i = idx - 1; i >= targetIndex; i--) {
      const prevState = charStatesRef.current[i];
      charStatesRef.current[i] = "pending";
      if (prevState === "correct") {
        correctCountRef.current = Math.max(0, correctCountRef.current - 1);
      } else if (prevState === "incorrect") {
        incorrectCountRef.current = Math.max(0, incorrectCountRef.current - 1);
        const lastMatch = errorsRef.current.map((err) => err.position).lastIndexOf(i);
        if (lastMatch !== -1) {
          errorsRef.current = [
            ...errorsRef.current.slice(0, lastMatch),
            ...errorsRef.current.slice(lastMatch + 1),
          ];
        }
      }
    }

    currentIndexRef.current = targetIndex;
    setCurrentIndex(targetIndex);
    setCharStates([...charStatesRef.current]);
    setCorrectCount(correctCountRef.current);
    setIncorrectCount(incorrectCountRef.current);
    setErrors([...errorsRef.current]);
  }, [targetText]);

  const applyCharacter = useCallback(
    (typedChar: string) => {
      const idx = currentIndexRef.current;
      if (idx >= targetText.length) return;

      const currentStarted = startedAtRef.current;
      if (!currentStarted) {
        const start = Date.now();
        startedAtRef.current = start;
        setStartedAt(start);
      }

      const expected = targetText[idx];
      const isCorrect = typedChar === expected;

      // Handle accidental extra/duplicate characters non-destructively
      const wordStart = findWordStart(targetText, idx);
      const isWordChar = (c: string) => /[\p{L}\p{N}'’-]/u.test(c);
      const isDuplicate = !isCorrect && idx > 0 && typedChar === targetText[idx - 1] && isWordChar(typedChar);
      const isAtWordEnd = !isCorrect && expected === " " && isWordChar(typedChar);

      if (isDuplicate || isAtWordEnd) {
        extraCharsRef.current = {
          ...extraCharsRef.current,
          [wordStart]: [...(extraCharsRef.current[wordStart] || []), typedChar],
        };
        setExtraChars({ ...extraCharsRef.current });
        incorrectCountRef.current += 1;
        setIncorrectCount(incorrectCountRef.current);
        const errorPos = isAtWordEnd ? Math.max(0, idx - 1) : idx;
        const word = wordAtPosition(targetText, errorPos);
        errorsRef.current.push({
          expected_char: expected,
          typed_char: typedChar,
          position: idx,
          word,
          sentence_id: sentenceIdAt(idx),
        });
        if (word) onWordError?.(word, errorPos);
        soundEngine.play("error");
        return;
      }

      const nextIndex = idx + 1;
      currentIndexRef.current = nextIndex;
      charStatesRef.current[idx] = isCorrect ? "correct" : "incorrect";

      let finalCorrectCount = correctCountRef.current;
      let finalIncorrectCount = incorrectCountRef.current;

      if (isCorrect) {
        finalCorrectCount += 1;
        correctCountRef.current = finalCorrectCount;
        soundEngine.play("keystroke");
      } else {
        finalIncorrectCount += 1;
        correctCountRef.current = finalCorrectCount;
        incorrectCountRef.current = finalIncorrectCount;
        soundEngine.play("error");

        const word = wordAtPosition(targetText, idx);
        errorsRef.current.push({
          expected_char: expected,
          typed_char: typedChar,
          position: idx,
          word,
          sentence_id: sentenceIdAt(idx),
        });
        if (word) onWordError?.(word, idx);
      }

      setCurrentIndex(nextIndex);
      setCharStates([...charStatesRef.current]);
      setCorrectCount(finalCorrectCount);
      setIncorrectCount(finalIncorrectCount);
      setErrors([...errorsRef.current]);

      checkSentenceCompletion(nextIndex);

      if (nextIndex >= targetText.length) {
        const start = startedAtRef.current ?? Date.now();
        const durationSeconds = Math.max((Date.now() - start) / 1000, 0.1);
        const total = finalCorrectCount + finalIncorrectCount;
        const finalWpm = Math.round(total / 5 / (durationSeconds / 60));
        const wpmHistory =
          wpmHistoryRef.current.length > 0 ? [...wpmHistoryRef.current, finalWpm] : [finalWpm];

        onComplete?.({
          correct_characters: finalCorrectCount,
          incorrect_characters: finalIncorrectCount,
          total_characters: finalCorrectCount + finalIncorrectCount,
          duration_seconds: durationSeconds,
          errors: [...errorsRef.current],
          finalCharStates: [...charStatesRef.current],
          wpmHistory,
        });
      }
    },
    [targetText, sentenceIdAt, checkSentenceCompletion, onWordError, onComplete]
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (isComplete) return;

      if (e.key === "Backspace") {
        e.preventDefault();
        if (e.ctrlKey || e.altKey || e.metaKey) {
          applyWordBackspace();
        } else {
          applyBackspace();
        }
        return;
      }

      // A shortcut is not a character: without this, Cmd/Ctrl+A, +V or +K typed the
      // letter into the exercise (and counted it as an error) while also triggering
      // the browser's or the app's own action.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key.length !== 1) return;
      e.preventDefault();
      applyCharacter(e.key);
    },
    [isComplete, applyBackspace, applyWordBackspace, applyCharacter]
  );

  const handleInput = useCallback(
    (e: ReactFormEvent<HTMLInputElement>) => {
      const target = e.currentTarget;
      const native = e.nativeEvent as InputEvent;

      if (!isComplete) {
        if (native.inputType?.startsWith("delete")) {
          applyBackspace();
        } else if (native.data && native.data.length === 1) {
          applyCharacter(native.data);
        }
      }

      target.value = "";
    },
    [isComplete, applyBackspace, applyCharacter]
  );

  const totalTyped = correctCount + incorrectCount;
  const elapsedSeconds = startedAt ? (now - startedAt) / 1000 : 0;
  const liveWpm = elapsedSeconds > 0 ? Math.round(totalTyped / 5 / (elapsedSeconds / 60)) : 0;
  const liveAccuracy = totalTyped > 0 ? Math.round((correctCount / totalTyped) * 100) : 100;

  return {
    charStates,
    currentIndex,
    extraChars,
    isComplete,
    liveWpm,
    liveAccuracy,
    handleKeyDown,
    handleInput,
  };
}
