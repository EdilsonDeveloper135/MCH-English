"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useTypingStore } from '@/stores/typingStore';

interface FluidCaretProps {
  containerRef: React.RefObject<HTMLElement>;
  currentIndex: number;
  isComplete: boolean;
}

export function FluidCaret({ containerRef, currentIndex, isComplete }: FluidCaretProps) {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [isIdle, setIsIdle] = useState(true);
  const [wpm, setWpm] = useState(0);
  const keystrokesRef = useRef<number[]>([]);
  
  const cursorStyle = useTypingStore((s) => s.preferences.cursorStyle);

  useEffect(() => {
    const now = Date.now();
    keystrokesRef.current.push(now);
    
    if (keystrokesRef.current.length > 5) {
      keystrokesRef.current.shift();
    }
    
    if (keystrokesRef.current.length > 1) {
      const oldest = keystrokesRef.current[0];
      const newest = keystrokesRef.current[keystrokesRef.current.length - 1];
      const timeDiffMs = newest - oldest;
      if (timeDiffMs > 0) {
        const charsPerMs = (keystrokesRef.current.length - 1) / timeDiffMs;
        const currentWpm = (charsPerMs * 1000 * 60) / 5;
        setWpm(currentWpm);
      }
    }

    setIsIdle(false);
    const idleTimeout = setTimeout(() => setIsIdle(true), 500);
    return () => clearTimeout(idleTimeout);
  }, [currentIndex]);

  useEffect(() => {
    if (!containerRef.current || isComplete) return;

    const charElement = containerRef.current.querySelector(`[data-char-index="${currentIndex}"]`) as HTMLElement;
    if (charElement) {
      // Measured against the same element the caret is positioned inside, so the two
      // coordinate systems match (they used to differ by the header's height).
      const containerRect = containerRef.current.getBoundingClientRect();
      const charRect = charElement.getBoundingClientRect();

      setPosition({
        top: charRect.top - containerRect.top + containerRef.current.scrollTop,
        left: charRect.left - containerRect.left + containerRef.current.scrollLeft,
        width: charRect.width,
        height: charRect.height,
      });
      // No scrollIntoView here: TypingDisplay already scrolls its own viewport, and a
      // smooth scroll per character fought with it and thrashed layout at speed.
    }
  }, [currentIndex, containerRef, isComplete]);

  if (isComplete) return null;

  let transitionSpeed = 100;
  if (wpm > 80) transitionSpeed = 40;
  else if (wpm > 40) transitionSpeed = 70;

  let style: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    transform: `translate3d(${position.left}px, ${position.top}px, 0)`,
    transition: `transform ${transitionSpeed}ms cubic-bezier(0.4, 0, 0.2, 1)`,
    willChange: 'transform',
    pointerEvents: 'none',
    zIndex: 10,
    opacity: isIdle ? 0.8 : 1,
  };

  let className = "bg-[var(--accent)]";

  if (cursorStyle === 'block') {
    style.width = `${position.width || 10}px`;
    style.height = `${position.height || 24}px`;
    style.opacity = isIdle ? 0.4 : 0.5;
  } else if (cursorStyle === 'underline') {
    style.width = `${position.width || 10}px`;
    style.height = `2px`;
    style.marginTop = `${(position.height || 24) - 2}px`;
  } else {
    style.width = '2px';
    style.height = `${position.height || 24}px`;
  }

  if (isIdle) {
    className += " animate-pulse";
  }

  return (
    <div style={style} className={className} />
  );
}
