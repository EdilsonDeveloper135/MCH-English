"use client";

import { useState, useRef, useCallback, useEffect } from 'react';

const MILESTONES = [10, 25, 50, 100];

/** Counts consecutive words typed without a single wrong character, and surfaces the
 * milestone worth celebrating. Purely session-local state -- nothing is persisted. */
export function useStreakTracker() {
  const [milestone, setMilestone] = useState<number | null>(null);
  const milestoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const checkMilestone = useCallback((streak: number) => {
    if (!MILESTONES.includes(streak)) return;
    setMilestone(streak);
    if (milestoneTimeoutRef.current) clearTimeout(milestoneTimeoutRef.current);
    milestoneTimeoutRef.current = setTimeout(() => setMilestone(null), 2500);
  }, []);

  const onWordComplete = useCallback(
    (isCorrect: boolean) => {
      if (!isCorrect) {
        setCurrentStreak(0);
        return;
      }
      setCurrentStreak((prev) => {
        const nextStreak = prev + 1;
        setBestStreak((best) => Math.max(best, nextStreak));
        checkMilestone(nextStreak);
        return nextStreak;
      });
    },
    [checkMilestone]
  );

  const reset = useCallback(() => {
    setCurrentStreak(0);
    setBestStreak(0);
    setMilestone(null);
    if (milestoneTimeoutRef.current) clearTimeout(milestoneTimeoutRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (milestoneTimeoutRef.current) clearTimeout(milestoneTimeoutRef.current);
    };
  }, []);

  return { currentStreak, bestStreak, milestone, onWordComplete, reset };
}
