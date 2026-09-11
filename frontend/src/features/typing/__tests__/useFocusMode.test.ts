import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFocusMode } from "../hooks/useFocusMode";
import { useTypingStore } from "@/stores/typingStore";

function typeKey() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
}

describe("useFocusMode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTypingStore.setState({ isFocusMode: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("turns focus mode on while typing and off again once the user stops", () => {
    // It used to read a store field that did not exist, so focus mode switched on
    // after two keystrokes and could never switch off: the header stayed invisible
    // and unclickable for the rest of the session.
    const { result } = renderHook(() => useFocusMode({ enabled: true, keystrokeThreshold: 2, typingTimeoutMs: 3000 }));

    act(() => {
      typeKey();
      typeKey();
    });
    expect(result.current.isFocused).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(result.current.isFocused).toBe(false);
  });

  it("stays off entirely when disabled", () => {
    const { result } = renderHook(() => useFocusMode({ enabled: false, keystrokeThreshold: 1 }));

    act(() => {
      typeKey();
      typeKey();
    });

    expect(result.current.isFocused).toBe(false);
  });

  it("releases focus mode when the screen unmounts", () => {
    const { unmount } = renderHook(() => useFocusMode({ enabled: true, keystrokeThreshold: 1 }));

    act(() => typeKey());
    expect(useTypingStore.getState().isFocusMode).toBe(true);

    unmount();
    expect(useTypingStore.getState().isFocusMode).toBe(false);
  });
});
