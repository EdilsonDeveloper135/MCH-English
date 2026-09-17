import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useGlobalHotkeys } from "../useGlobalHotkeys";

describe("useGlobalHotkeys", () => {
  it("triggers onQuickSearch on Cmd+K or Ctrl+K", () => {
    const onQuickSearch = vi.fn();
    renderHook(() => useGlobalHotkeys({ onQuickSearch }));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    expect(onQuickSearch).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    expect(onQuickSearch).toHaveBeenCalledTimes(2);
  });

  it("triggers onNewText on Cmd+N or Ctrl+N", () => {
    const onNewText = vi.fn();
    renderHook(() => useGlobalHotkeys({ onNewText }));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true }));
    expect(onNewText).toHaveBeenCalledTimes(1);
  });

  it("triggers onEscape on Escape", () => {
    const onEscape = vi.fn();
    renderHook(() => useGlobalHotkeys({ onEscape }));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("triggers onToggleHelp on Cmd+/", () => {
    const onToggleHelp = vi.fn();
    renderHook(() => useGlobalHotkeys({ onToggleHelp }));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", metaKey: true }));
    expect(onToggleHelp).toHaveBeenCalledTimes(1);
  });
});
