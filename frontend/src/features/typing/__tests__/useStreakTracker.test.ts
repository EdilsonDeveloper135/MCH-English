import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStreakTracker } from "../hooks/useStreakTracker";

describe("useStreakTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with zero streak and no milestone", () => {
    const { result } = renderHook(() => useStreakTracker());
    expect(result.current.currentStreak).toBe(0);
    expect(result.current.bestStreak).toBe(0);
    expect(result.current.milestone).toBeNull();
  });

  it("increments streak on correct words", () => {
    const { result } = renderHook(() => useStreakTracker());

    act(() => {
      result.current.onWordComplete(true);
      result.current.onWordComplete(true);
      result.current.onWordComplete(true);
    });

    expect(result.current.currentStreak).toBe(3);
    expect(result.current.bestStreak).toBe(3);
  });

  it("resets current streak on incorrect word while preserving best streak", () => {
    const { result } = renderHook(() => useStreakTracker());

    act(() => {
      for (let i = 0; i < 5; i++) result.current.onWordComplete(true);
    });

    expect(result.current.currentStreak).toBe(5);
    expect(result.current.bestStreak).toBe(5);

    act(() => {
      result.current.onWordComplete(false);
    });

    expect(result.current.currentStreak).toBe(0);
    expect(result.current.bestStreak).toBe(5);
  });

  it("triggers milestone at 10 words", () => {
    const { result } = renderHook(() => useStreakTracker());

    act(() => {
      for (let i = 0; i < 10; i++) result.current.onWordComplete(true);
    });

    expect(result.current.currentStreak).toBe(10);
    expect(result.current.milestone).toBe(10);

    // Auto-clears after timer
    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(result.current.milestone).toBeNull();
  });
});
