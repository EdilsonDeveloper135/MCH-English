"use client";

import React from 'react';
import { useTypingStore } from '@/stores/typingStore';

interface StreakNotificationProps {
  milestone: number | null;
}

export function StreakNotification({ milestone }: StreakNotificationProps) {
  const reduceMotion = useTypingStore((s) => s.preferences.reduceMotion);

  if (milestone === null) return null;

  // Class names that exist in tailwind.config.ts (the previous ones did not).
  const animationClass = reduceMotion ? 'animate-fadeIn' : 'animate-scaleIn';

  return (
    <div className="fixed top-4 right-4 z-40 pointer-events-none">
      <div className={`bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg px-3 py-1.5 font-mono text-sm font-medium transition-opacity duration-300 ${animationClass}`}>
        {milestone} PERFECT
      </div>
    </div>
  );
}
