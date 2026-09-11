import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSmartPause } from "../hooks/useSmartPause";

describe("useSmartPause", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts unpaused", () => {
    const { result } = renderHook(() => useSmartPause({ enabled: true, timeoutMs: 5000 }));
    expect(result.current.isPaused).toBe(false);
    expect(result.current.pausedTime).toBe(0);
  });

  it("pauses after idle timeout", () => {
    const { result } = renderHook(() => useSmartPause({ enabled: true, timeoutMs: 5000 }));
    
    // Simulate initial keystroke
    act(() => {
      result.current.handleKeystroke();
    });

    expect(result.current.isPaused).toBe(false);

    // Advance past timeout
    act(() => {
      vi.advanceTimersByTime(5500);
    });

    expect(result.current.isPaused).toBe(true);
  });

  it("resumes and accumulates paused time on next keystroke", () => {
    const { result } = renderHook(() => useSmartPause({ enabled: true, timeoutMs: 5000 }));
    
    act(() => {
      result.current.handleKeystroke();
      vi.advanceTimersByTime(5500);
    });

    expect(result.current.isPaused).toBe(true);

    // Keystroke to resume
    act(() => {
      vi.advanceTimersByTime(2000); // stay paused 2s
      result.current.handleKeystroke();
    });

    expect(result.current.isPaused).toBe(false);
    expect(result.current.pausedTime).toBeGreaterThanOrEqual(2000);
  });

  it("resets cleanly", () => {
    const { result } = renderHook(() => useSmartPause({ enabled: true, timeoutMs: 5000 }));
    
    act(() => {
      result.current.handleKeystroke();
      vi.advanceTimersByTime(6000);
      result.current.reset();
    });

    expect(result.current.isPaused).toBe(false);
    expect(result.current.pausedTime).toBe(0);
  });
});
