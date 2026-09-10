"use client";

import type { CharStatus } from "@/features/typing/useTypingSession";
import type { BlankDTO } from "@/types";

const STATE_CLASSES: Record<CharStatus, string> = {
  pending: "text-gray-400",
  correct: "text-white",
  incorrect: "text-red-500 bg-red-500/10",
};

/** The concatenated letters of just the blanked words, one real space between each
 * -- this is what feeds useTypingSession (only the blanks are ever typeable). A
 * single space matches how the words already appear separated in the sentence, so
 * pressing space between them (the natural instinct) is correct instead of an error. */
export function buildBlankTargetText(content: string, blanks: BlankDTO[]): string {
  return blanks.map((b) => content.slice(b.start, b.end)).join(" ");
}

interface MissingWordsTextProps {
  content: string;
  blanks: BlankDTO[];
  charStates: CharStatus[];
  currentIndex: number;
}

type Segment =
  | { type: "text"; text: string }
  | { type: "blank"; char: string; targetIndex: number }
  | { type: "space"; targetIndex: number };

function buildSegments(content: string, blanks: BlankDTO[]): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  let targetIndex = 0;

  blanks.forEach((blank, i) => {
    if (blank.start > cursor) segments.push({ type: "text", text: content.slice(cursor, blank.start) });
    for (let p = blank.start; p < blank.end; p++) {
      segments.push({ type: "blank", char: content[p], targetIndex: targetIndex++ });
    }
    cursor = blank.end;
    if (i < blanks.length - 1) segments.push({ type: "space", targetIndex: targetIndex++ });
  });
  if (cursor < content.length) segments.push({ type: "text", text: content.slice(cursor) });

  return segments;
}

export function MissingWordsText({ content, blanks, charStates, currentIndex }: MissingWordsTextProps) {
  const segments = buildSegments(content, blanks);

  return (
    <div className="font-mono text-xl leading-relaxed whitespace-pre-wrap tracking-wide select-none">
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return (
            <span key={i} className="text-gray-300">
              {seg.text}
            </span>
          );
        }

        const state = charStates[seg.targetIndex] ?? "pending";
        const isCurrent = seg.targetIndex === currentIndex;

        if (seg.type === "space") {
          return (
            <span
              key={i}
              className={[state === "incorrect" ? "bg-red-500/10" : "", isCurrent ? "border-l-2 border-cyan-400" : ""].join(
                " "
              )}
            >
              {" "}
            </span>
          );
        }

        const display = state === "pending" ? "_" : seg.char;
        return (
          <span key={i} className={[STATE_CLASSES[state], isCurrent ? "border-l-2 border-cyan-400" : ""].join(" ")}>
            {display}
          </span>
        );
      })}
    </div>
  );
}
