import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FormEvent, KeyboardEvent } from "react";
import { buildTargetText, findSentenceIdAt, findWordStart, useTypingSession, wordAtPosition } from "./useTypingSession";

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

  it("calls onWordError with the complete target word and index when any character is mistyped", () => {
    const onWordError = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({ targetText: "Hi cats", sentenceRanges: [], onWordError })
    );

    act(() => result.current.handleKeyDown(keyEvent("H")));
    act(() => result.current.handleKeyDown(keyEvent("i")));
    act(() => result.current.handleKeyDown(keyEvent(" ")));
    act(() => result.current.handleKeyDown(keyEvent("x"))); // typo on "cats"

    expect(onWordError).toHaveBeenCalledWith("cats", 3);
  });

  it("calls onWordError with the complete word for errors in first, middle, or last letter", () => {
    const onWordError = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({ targetText: "elephant", sentenceRanges: [], onWordError })
    );

    // Mistype first letter
    act(() => result.current.handleKeyDown(keyEvent("x")));
    expect(onWordError).toHaveBeenLastCalledWith("elephant", 0);

    // Undo and type correctly then mistype middle letter
    act(() => result.current.handleKeyDown(keyEvent("Backspace")));
    act(() => result.current.handleKeyDown(keyEvent("e")));
    act(() => result.current.handleKeyDown(keyEvent("l")));
    act(() => result.current.handleKeyDown(keyEvent("x"))); // mistyped 'e'
    expect(onWordError).toHaveBeenLastCalledWith("elephant", 2);
  });

  it("buffers extra characters typed at word end without advancing into next word", () => {
    const onWordError = vi.fn();
    const { result } = renderHook(() =>
      useTypingSession({ targetText: "cat dog", sentenceRanges: [], onWordError })
    );

    // Type "cat"
    for (const ch of "cat") {
      act(() => result.current.handleKeyDown(keyEvent(ch)));
    }
    expect(result.current.currentIndex).toBe(3); // index of space

    // Accidentally type 's' instead of space
    act(() => result.current.handleKeyDown(keyEvent("s")));
    expect(result.current.currentIndex).toBe(3); // cursor must NOT advance past space
    expect(result.current.extraChars[0]).toEqual(["s"]);
    expect(onWordError).toHaveBeenCalledWith("cat", 2);

    // Backspace removes the extra character
    act(() => result.current.handleKeyDown(keyEvent("Backspace")));
    expect(result.current.currentIndex).toBe(3);
    expect(result.current.extraChars[0]).toBeUndefined();

    // Now type space and continue
    act(() => result.current.handleKeyDown(keyEvent(" ")));
    expect(result.current.currentIndex).toBe(4); // moves to 'd' in "dog"
  });

  it("extracts complete words including accented and hyphenated compound words", () => {
    expect(wordAtPosition("a café visit", 4)).toBe("café");
    expect(wordAtPosition("a well-known book", 6)).toBe("well-known");
    expect(wordAtPosition("a well-known book", 2)).toBe("well-known");
    expect(wordAtPosition("a naïve person", 4)).toBe("naïve");
  });

  it("atomic word backspace (Ctrl+Backspace) reverts the current word in a single action", () => {
    const { result } = renderHook(() =>
      useTypingSession({ targetText: "the quick brown", sentenceRanges: [] })
    );

    // Type "the quic"
    for (const ch of "the quic") {
      act(() => result.current.handleKeyDown(keyEvent(ch)));
    }
    expect(result.current.currentIndex).toBe(8);

    // Press Ctrl+Backspace
    act(() =>
      result.current.handleKeyDown({
        key: "Backspace",
        ctrlKey: true,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent<HTMLInputElement>)
    );

    // Cursor should jump back to start of "quick" (index 4)
    expect(result.current.currentIndex).toBe(4);
    expect(result.current.charStates[4]).toBe("pending");
    expect(result.current.charStates[3]).toBe("correct"); // space after "the"
  });

  it("handles rapid burst typing without losing characters or state race conditions", () => {
    const onComplete = vi.fn();
    const text = "rapid burst typing test without losing any single character";
    const { result } = renderHook(() =>
      useTypingSession({ targetText: text, sentenceRanges: [], onComplete })
    );

    // Fire 60 keystrokes synchronously in a tight loop (simulating >100 WPM burst)
    act(() => {
      for (const ch of text) {
        result.current.handleKeyDown(keyEvent(ch));
      }
    });

    expect(result.current.currentIndex).toBe(text.length);
    expect(result.current.isComplete).toBe(true);
    expect(onComplete).toHaveBeenCalledTimes(1);
    const stats = onComplete.mock.calls[0][0];
    expect(stats.correct_characters).toBe(text.length);
    expect(stats.incorrect_characters).toBe(0);
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

describe("useTypingSession keyboard shortcuts", () => {
  it("ignores Ctrl/Cmd/Alt combinations instead of typing the letter", () => {
    const { result } = renderHook(() => useTypingSession({ targetText: "abc", sentenceRanges: [] }));

    act(() =>
      result.current.handleKeyDown({
        key: "a",
        metaKey: true,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent<HTMLInputElement>)
    );
    act(() =>
      result.current.handleKeyDown({
        key: "v",
        ctrlKey: true,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent<HTMLInputElement>)
    );

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.charStates).toEqual(["pending", "pending", "pending"]);
  });

  it("restarts the exercise when resetKey changes, even with the same text", () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => useTypingSession({ targetText: "abc", sentenceRanges: [], resetKey }),
      { initialProps: { resetKey: 1 } }
    );

    act(() => result.current.handleKeyDown(keyEvent("a")));
    expect(result.current.currentIndex).toBe(1);

    rerender({ resetKey: 2 });
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.charStates).toEqual(["pending", "pending", "pending"]);
  });
});
