"use client";

import { useCallback, useEffect, useRef } from 'react';
import { useTypingStore } from '@/stores/typingStore';

export interface UseFocusModeProps {
  enabled?: boolean;
  keystrokeThreshold?: number;
  mouseTimeoutMs?: number;
  typingTimeoutMs?: number;
}

/** Fades the chrome away while the user is in flow and brings it back as soon as they
 * stop typing or reach for the mouse. */
export function useFocusMode({
  enabled = true,
  keystrokeThreshold = 2,
  mouseTimeoutMs = 3000,
  typingTimeoutMs = 3000
}: UseFocusModeProps = {}) {
  // `isFocusMode` -- the field the store actually defines. Reading a non-existent
  // `focusMode` (behind a @ts-ignore) made this always undefined, so focus mode turned
  // on after two keystrokes and could never turn off again.
  const isFocused = useTypingStore((state) => state.isFocusMode);
  const setFocusMode = useTypingStore((state) => state.setFocusMode);

  const keystrokeCount = useRef(0);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdleTimeout = useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }, []);

  const deactivateFocus = useCallback(() => {
    keystrokeCount.current = 0;
    setFocusMode(false);
  }, [setFocusMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeystroke = () => {
      if (!enabled) return;
      keystrokeCount.current += 1;
      if (keystrokeCount.current >= keystrokeThreshold) setFocusMode(true);

      clearIdleTimeout();
      idleTimeoutRef.current = setTimeout(deactivateFocus, typingTimeoutMs);
    };

    const handleMouseMove = () => {
      if (!enabled) return;
      clearIdleTimeout();
      idleTimeoutRef.current = setTimeout(deactivateFocus, mouseTimeoutMs);
    };

    window.addEventListener('keydown', handleKeystroke);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeystroke);
      window.removeEventListener('mousemove', handleMouseMove);
      clearIdleTimeout();
    };
  }, [enabled, keystrokeThreshold, typingTimeoutMs, mouseTimeoutMs, clearIdleTimeout, deactivateFocus, setFocusMode]);

  // Leaving the screen must not strand the rest of the app in focus mode -- the header
  // is hidden while it is on.
  useEffect(() => {
    return () => setFocusMode(false);
  }, [setFocusMode]);

  return { isFocused, setFocusMode };
}
