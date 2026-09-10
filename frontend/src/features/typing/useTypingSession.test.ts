import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FormEvent, KeyboardEvent } from "react";
import { buildTargetText, findSentenceIdAt, useTypingSession } from "./useTypingSession";

function keyEvent(key: string) {
  return { key, preventDefault: vi.fn() } as unknown as KeyboardEvent<HTMLInputElement>;
}

describe("buildTargetText", () => {
  it("concatenates sentences with a single space and tracks their ranges", () => {
    const { text, sentenceRanges } = buildTargetText([
      { id: "a", content: "Hi there." },
      { id: "b", content: "Bye now." },
    ]);

    expect(text).toBe("Hi there. Bye now.");
    expect(sentenceRanges).toEqual([
      { sentenceId: "a", start: 0, end: 9 },
      { sentenceId: "b", start: 10, end: 18 },
    ]);
  });
});

describe("findSentenceIdAt", () => {
  it("finds which sentence a position falls in", () => {
    const ranges = [
      { sentenceId: "a", start: 0, end: 5 },
      { sentenceId: "b", start: 6, end: 10 },
    ];
    expect(findSentenceIdAt(ranges, 2)).toBe("a");
    expect(findSentenceIdAt(ranges, 6)).toBe("b");
    expect(findSentenceIdAt(ranges, 5)).toBeNull(); // the gap (the space) belongs to no sentence
  });
});

describe("useTypingSession", () => {
  it("marks correctly typed characters and advances the cursor", () => {
    const { result } = renderHook(() => useTypingSession({ targetText: "Hi", sentenceRanges: [] }));

    act(() => result.current.handleKeyDown(keyEvent("H")));
    expect(result.current.charStates[0]).toBe("correct");
    expect(result.current.currentIndex).toBe(1);

    act(() => result.current.handleKeyDown(keyEvent("i")));
    expect(result.current.charStates[1]).toBe("correct");
    expect(result.current.currentIndex).toBe(2);
    expect(result.current.isComplete).toBe(true);
  });

  it("marks a mistyped character as incorrect without blocking the cursor", () => {
    const { result } = renderHook(() => useTypingSession({ targetText: "Hi", sentenceRanges: [] }));

    act(() => result.current.handleKeyDown(keyEvent("x")));
    expect(result.current.charStates[0]).toBe("incorrect");
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.liveAccuracy).toBe(0);
  });

  it("Backspace reverts the previous character to pending and moves the cursor back", () => {
    // Three characters, not two -- typing both keystrokes below must NOT complete
    // the session, otherwise handleKeyDown's `if (isComplete) return` guard would
    // swallow the Backspace this test is trying to exercise.
    const { result } = renderHook(() => useTypingSession({ targetText: "Hip", sentenceRanges: [] }));

    act(() => result.current.handleKeyDown(keyEvent("H")));
    act(() => result.current.handleKeyDown(keyEvent("x"))); // incorrect at position 1 (expected "i")
    expect(result.current.currentIndex).toBe(2);
    expect(result.current.liveAccuracy).toBe(50);

    act(() => result.current.handleKeyDown(keyEvent("Backspace")));
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.charStates[1]).toBe("pending");
    // Undoing the incorrect keystroke must also undo its count, not just its color,
    // otherwise retyping it correctly would double-count towards accuracy.
    expect(result.current.liveAccuracy).toBe(100);

    act(() => result.current.handleKeyDown(keyEvent("Backspace")));
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.charStates[0]).toBe("pending");
  });

  it("Backspace at position 0 is a no-op", () => {
    const { result } = renderHook(() => useTypingSession({ targetText: "Hi", sentenceRanges: [] }));

    act(() => result.current.handleKeyDown(keyEvent("Backspace")));
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.charStates[0]).toBe("pending");
  });

  it("computes live WPM from elapsed time using the 5-characters-per-word convention", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2024, 0, 1, 0, 0, 0));
      const { result } = renderHook(() => useTypingSession({ targetText: "Hello world", sentenceRanges: [] }));

      act(() => result.current.handleKeyDown(keyEvent("H")));
      for (const ch of "ello") {
        act(() => result.current.handleKeyDown(keyEvent(ch)));
      }
      // Advance 30s and let the hook's internal 1s ticker refresh `now`.
      act(() => vi.advanceTimersByTime(30_000));

      // 5 correct characters typed ("Hello"), 30s elapsed since the first keystroke
      // started the timer -> (5/5 words) / (30/60 min) = 2 WPM.
      expect(result.current.liveWpm).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fires onComplete with aggregate stats once the target text is fully typed", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useTypingSession({ targetText: "Hi", sentenceRanges: [], onComplete }));

    act(() => result.current.handleKeyDown(keyEvent("H")));
    act(() => result.current.handleKeyDown(keyEvent("x")));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const stats = onComplete.mock.calls[0][0];
    expect(stats.correct_characters).toBe(1);
    expect(stats.incorrect_characters).toBe(1);
    expect(stats.total_characters).toBe(2);
    expect(stats.finalCharStates).toEqual(["correct", "incorrect"]);
  });

  it("calls onWordError with the target word once a character inside it is mistyped", () => {
    const onWordError = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({ targetText: "Hi cats", sentenceRanges: [], onWordError })
    );

    act(() => result.current.handleKeyDown(keyEvent("H")));
    act(() => result.current.handleKeyDown(keyEvent("i")));
    act(() => result.current.handleKeyDown(keyEvent(" ")));
    act(() => result.current.handleKeyDown(keyEvent("x"))); // typo on "cats"

    expect(onWordError).toHaveBeenCalledWith("c");
  });

  it("handleInput processes a native InputEvent the same way, for virtual keyboards that don't report a real keydown key", () => {
    const { result } = renderHook(() => useTypingSession({ targetText: "Hi", sentenceRanges: [] }));

    const input = { value: "" };
    const makeEvent = (inputType: string, data: string | null) => ({
      currentTarget: input,
      nativeEvent: { inputType, data } as unknown as InputEvent,
    }) as unknown as FormEvent<HTMLInputElement>;

    act(() => result.current.handleInput(makeEvent("insertText", "H")));
    expect(result.current.charStates[0]).toBe("correct");
    expect(result.current.currentIndex).toBe(1);
    expect(input.value).toBe(""); // always reset so the field never accumulates text

    act(() => result.current.handleInput(makeEvent("deleteContentBackward", null)));
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.charStates[0]).toBe("pending");
  });
});
