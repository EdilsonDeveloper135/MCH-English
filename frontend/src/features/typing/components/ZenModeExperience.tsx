"use client";

import React, { useRef } from "react";
import type { CharStatus } from "@/types/typing";
import { TypingDisplay } from "./TypingDisplay";
import { FluidCaret } from "./FluidCaret";

interface ZenModeExperienceProps {
  targetText: string;
  charStates: CharStatus[];
  currentIndex: number;
  extraChars?: Record<number, string[]>;
  onExit: () => void;
}

/** Pure, distraction-free Zen typing experience.
 * Only the text and the fluid caret are displayed. All navigation, stats, and chrome disappear. */
export function ZenModeExperience({
  targetText,
  charStates,
  currentIndex,
  extraChars,
  onExit,
}: ZenModeExperienceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isComplete = targetText.length > 0 && currentIndex >= targetText.length;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 bg-[var(--bg-primary)] transition-colors duration-300 select-none cursor-text"
    >
      {/* Subtle Exit Trigger Button */}
      <button
        type="button"
        onClick={onExit}
        className="fixed top-6 right-8 text-xs font-mono text-neutral-600 hover:text-neutral-300 transition-colors px-3 py-1.5 rounded-full border border-transparent hover:border-neutral-800"
        title="Salir de Modo Zen (Esc / Ctrl+F)"
      >
        Salir de Zen [Esc]
      </button>

      {/* Main Text Presentation */}
      <div className="relative w-full max-w-3xl my-auto">
        <FluidCaret
          containerRef={containerRef}
          currentIndex={currentIndex}
          isComplete={isComplete}
        />
        <TypingDisplay
          targetText={targetText}
          charStates={charStates}
          currentIndex={currentIndex}
          extraChars={extraChars}
        />
      </div>

      <div className="fixed bottom-6 text-[11px] font-mono text-neutral-700 tracking-wider">
        ZEN MODE — FLOW STATE
      </div>
    </div>
  );
}
