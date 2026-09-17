"use client";

import { useEffect } from "react";

export interface GlobalHotkeysOptions {
  onQuickSearch?: () => void;
  onNewText?: () => void;
  onEscape?: () => void;
  onToggleHelp?: () => void;
  disabled?: boolean;
}

export function useGlobalHotkeys({
  onQuickSearch,
  onNewText,
  onEscape,
  onToggleHelp,
  disabled = false,
}: GlobalHotkeysOptions) {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isInputField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        if (onEscape) {
          onEscape();
        }
        return;
      }

      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onQuickSearch?.();
        return;
      }

      if (isMod && e.key.toLowerCase() === "n") {
        // Prevent browser new window and open new text modal
        e.preventDefault();
        onNewText?.();
        return;
      }

      if (isMod && (e.key === "/" || e.code === "Slash")) {
        e.preventDefault();
        onToggleHelp?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onQuickSearch, onNewText, onEscape, onToggleHelp, disabled]);
}
