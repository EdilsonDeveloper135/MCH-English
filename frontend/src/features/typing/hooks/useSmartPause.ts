"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseSmartPauseProps {
  enabled?: boolean;
  timeoutMs?: number;
}

export function useSmartPause({ enabled = true, timeoutMs = 5000 }: UseSmartPauseProps = {}) {
  const [isPaused, setIsPaused] = useState(false);
  const [pausedTime, setPausedTime] = useState(0);
  
  const lastKeystrokeTime = useRef<number>(Date.now());
  const pausedStartTime = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (!pausedStartTime.current && now - lastKeystrokeTime.current >= timeoutMs) {
        setIsPaused(true);
        pausedStartTime.current = lastKeystrokeTime.current + timeoutMs;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, timeoutMs]);

  const handleKeystroke = useCallback(() => {
    const now = Date.now();
    lastKeystrokeTime.current = now;

    if (pausedStartTime.current !== null) {
      setPausedTime(prev => prev + (now - pausedStartTime.current!));
      setIsPaused(false);
      pausedStartTime.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setIsPaused(false);
    setPausedTime(0);
    lastKeystrokeTime.current = Date.now();
    pausedStartTime.current = null;
  }, []);

  return { isPaused, pausedTime, handleKeystroke, reset };
}
