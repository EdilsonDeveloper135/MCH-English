import { beforeEach, describe, expect, it } from "vitest";
import { defaultPreferences, useTypingStore } from "../typingStore";
import type { GhostData } from "@/types/typing";

function ghost(chunkIndex: number, points = 10): GhostData {
  return {
    textId: "text-1",
    chunkIndex,
    finalWpm: 60,
    totalChars: 100,
    keystrokePositions: Array.from({ length: points }, (_, i) => ({ time: i * 100, charIndex: i })),
  };
}

describe("typingStore", () => {
  beforeEach(() => {
    useTypingStore.setState({
      preferences: { ...defaultPreferences },
      isFocusMode: false,
      perKeyStats: {},
      ghostData: {},
    });
  });

  it("accumulates per-key stats in one batched merge per session", () => {
    const { mergePerKeyStats } = useTypingStore.getState();

    mergePerKeyStats({ a: { key: "a", errors: 1, correct: 4, totalReactionMs: 500, count: 5 } });
    mergePerKeyStats({ a: { key: "a", errors: 2, correct: 1, totalReactionMs: 300, count: 3 } });

    expect(useTypingStore.getState().perKeyStats.a).toEqual({
      key: "a",
      errors: 3,
      correct: 5,
      totalReactionMs: 800,
      count: 8,
    });
  });

  it("keeps ghost runs bounded so localStorage cannot grow without limit", () => {
    const { saveGhostData } = useTypingStore.getState();

    for (let i = 0; i < 30; i++) saveGhostData(ghost(i));

    expect(Object.keys(useTypingStore.getState().ghostData).length).toBeLessThanOrEqual(20);
    expect(useTypingStore.getState().ghostData["text-1-29"]).toBeDefined();
  });

  it("downsamples a long run instead of storing one point per keystroke", () => {
    useTypingStore.getState().saveGhostData(ghost(1, 5000));

    const stored = useTypingStore.getState().ghostData["text-1-1"];
    expect(stored.keystrokePositions.length).toBeLessThanOrEqual(201);
    // The end of the run is preserved, so the ghost still finishes where it should.
    expect(stored.keystrokePositions[stored.keystrokePositions.length - 1].charIndex).toBe(4999);
  });
});
