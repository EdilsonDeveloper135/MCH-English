"use client";

import type { CharStatus } from "@/features/typing/useTypingSession";

const STATE_CLASSES: Record<CharStatus, string> = {
  pending: "text-gray-400",
  correct: "text-white",
  incorrect: "text-red-500 bg-red-500/10",
};

interface TypingTextProps {
  targetText: string;
  charStates: CharStatus[];
  currentIndex: number;
  /** For Recall's Spanish -> English mode: don't reveal not-yet-typed letters,
   * show an underscore placeholder instead (word boundaries stay visible). */
  hidePending?: boolean;
}

export function TypingText({ targetText, charStates, currentIndex, hidePending = false }: TypingTextProps) {
  return (
    <div className="font-mono text-xl leading-relaxed whitespace-pre-wrap tracking-wide select-none">
      {targetText.split("").map((char, i) => {
        const state = charStates[i] ?? "pending";
        const isCurrent = i === currentIndex;
        const display = hidePending && state === "pending" && char !== " " ? "_" : char;
        return (
          <span
            key={i}
            className={[STATE_CLASSES[state], isCurrent ? "border-l-2 border-cyan-400" : ""].join(" ")}
          >
            {display}
          </span>
        );
      })}
    </div>
  );
}
