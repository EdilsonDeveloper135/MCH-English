"use client";

import type { CharStatus } from "@/features/typing/useTypingSession";
import type { BlankDTO } from "@/types";

const STATE_CLASSES: Record<CharStatus, string> = {
  pending: "text-gray-500",
  correct: "text-white",
  incorrect: "text-red-500 bg-red-500/10",
};

/** The concatenated letters of just the blanked words, in order -- this is what
 * feeds useTypingSession (only the blanks are ever typeable). */
export function buildBlankTargetText(content: string, blanks: BlankDTO[]): string {
  return blanks.map((b) => content.slice(b.start, b.end)).join("");
}

interface MissingWordsTextProps {
  content: string;
  blanks: BlankDTO[];
  charStates: CharStatus[];
  currentIndex: number;
}

export function MissingWordsText({ content, blanks, charStates, currentIndex }: MissingWordsTextProps) {
  const positionToBlankIndex = new Map<number, number>();
  let concatIndex = 0;
  for (const blank of blanks) {
    for (let p = blank.start; p < blank.end; p++) {
      positionToBlankIndex.set(p, concatIndex);
      concatIndex += 1;
    }
  }

  return (
    <div className="font-mono text-xl leading-relaxed whitespace-pre-wrap tracking-wide select-none">
      {content.split("").map((char, i) => {
        const blankPos = positionToBlankIndex.get(i);
        if (blankPos === undefined) {
          return (
            <span key={i} className="text-gray-300">
              {char}
            </span>
          );
        }

        const state = charStates[blankPos] ?? "pending";
        const isCurrent = blankPos === currentIndex;
        const display = state === "pending" ? "_" : char;
        return (
          <span key={i} className={[STATE_CLASSES[state], isCurrent ? "border-l-2 border-cyan-400" : ""].join(" ")}>
            {display}
          </span>
        );
      })}
    </div>
  );
}
