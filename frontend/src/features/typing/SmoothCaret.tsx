"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

interface SmoothCaretProps {
  containerRef: RefObject<HTMLElement>;
  currentIndex: number;
  isComplete: boolean;
}

export function SmoothCaret({ containerRef, currentIndex, isComplete }: SmoothCaretProps) {
  const [pos, setPos] = useState<{ left: number; top: number; height: number } | null>(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isComplete) {
      setPos(null);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Reset blink state on movement
    setIsBlinking(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIsBlinking(true), 500);

    const charEl = container.querySelector<HTMLElement>(`[data-char-index="${currentIndex}"]`);
    if (charEl) {
      const parentRect = container.getBoundingClientRect();
      const charRect = charEl.getBoundingClientRect();
      setPos({
        left: charRect.left - parentRect.left,
        top: charRect.top - parentRect.top,
        height: charRect.height || 26,
      });
      if (typeof charEl.scrollIntoView === "function") {
        charEl.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    } else {
      // If past the last char, place at the end of the last character
      const lastCharEl = container.querySelector<HTMLElement>(`[data-char-index="${currentIndex - 1}"]`);
      if (lastCharEl) {
        const parentRect = container.getBoundingClientRect();
        const charRect = lastCharEl.getBoundingClientRect();
        setPos({
          left: charRect.right - parentRect.left,
          top: charRect.top - parentRect.top,
          height: charRect.height || 26,
        });
      }
    }

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [containerRef, currentIndex, isComplete]);

  if (!pos || isComplete) return null;

  return (
    <span
      data-testid="smooth-caret"
      className={`absolute w-0.5 bg-[var(--accent,#22d3ee)] pointer-events-none rounded-full z-10 ${
        isBlinking ? "animate-caret-blink" : ""
      }`}
      style={{
        transform: `translate3d(${pos.left}px, ${pos.top}px, 0)`,
        height: `${pos.height}px`,
        transition: "transform 90ms cubic-bezier(0.1, 0.9, 0.2, 1.0), height 90ms ease",
      }}
      aria-hidden="true"
    />
  );
}
