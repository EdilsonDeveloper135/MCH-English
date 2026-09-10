"use client";

import { memo, useMemo } from "react";
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

interface Block {
  start: number;
  end: number;
  chars: string;
}

/** Splits into maximal runs of non-space / space characters (words and gaps), each
 * rendered by its own memoized block -- keystrokes only ever change charStates
 * around the cursor, so every block outside that word can skip re-rendering and
 * reconciling its `<span>`s entirely instead of the whole text redoing hundreds of
 * DOM nodes on every keypress. */
function splitIntoBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const re = /\S+|\s+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    blocks.push({ start: match.index, end: match.index + match[0].length, chars: match[0] });
  }
  return blocks;
}

export function TypingText({ targetText, charStates, currentIndex, hidePending = false }: TypingTextProps) {
  const blocks = useMemo(() => splitIntoBlocks(targetText), [targetText]);

  return (
    <div className="font-mono text-xl leading-relaxed whitespace-pre-wrap tracking-wide select-none">
      {blocks.map((block) => (
        <TypingWordBlock
          key={block.start}
          start={block.start}
          end={block.end}
          chars={block.chars}
          charStates={charStates}
          currentIndex={currentIndex}
          hidePending={hidePending}
        />
      ))}
    </div>
  );
}

interface TypingWordBlockProps {
  start: number;
  end: number;
  chars: string;
  charStates: CharStatus[];
  currentIndex: number;
  hidePending: boolean;
}

function areBlockPropsEqual(prev: TypingWordBlockProps, next: TypingWordBlockProps): boolean {
  if (prev.chars !== next.chars || prev.hidePending !== next.hidePending) return false;

  const prevCursorHere = prev.currentIndex >= prev.start && prev.currentIndex < prev.end;
  const nextCursorHere = next.currentIndex >= next.start && next.currentIndex < next.end;
  if (prevCursorHere !== nextCursorHere) return false;
  if (prevCursorHere && prev.currentIndex !== next.currentIndex) return false;

  for (let i = prev.start; i < prev.end; i++) {
    if (prev.charStates[i] !== next.charStates[i]) return false;
  }
  return true;
}

const TypingWordBlock = memo(function TypingWordBlock({
  start,
  chars,
  charStates,
  currentIndex,
  hidePending,
}: TypingWordBlockProps) {
  return (
    <>
      {chars.split("").map((char, offset) => {
        const i = start + offset;
        const state = charStates[i] ?? "pending";
        const isCurrent = i === currentIndex;
        const display = hidePending && state === "pending" && char !== " " ? "_" : char;
        return (
          <span key={i} className={[STATE_CLASSES[state], isCurrent ? "border-l-2 border-cyan-400" : ""].join(" ")}>
            {display}
          </span>
        );
      })}
    </>
  );
},
areBlockPropsEqual);
