"use client";

import React, { useEffect, useState } from "react";

export interface UnlockedAchievement {
  id: string;
  name: string;
  description: string;
}

interface AchievementToastProps {
  achievements: UnlockedAchievement[];
  onDismiss?: () => void;
}

export function AchievementToast({ achievements, onDismiss }: AchievementToastProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (achievements.length > 0) {
      setCurrentIdx(0);
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [achievements, onDismiss]);

  if (!visible || achievements.length === 0) return null;

  const current = achievements[currentIdx];
  if (!current) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 pointer-events-none select-none max-w-sm"
    >
      <div className="toast-slide-anim bg-neutral-900 border-2 border-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.3)] rounded-2xl p-4 flex items-center gap-3.5 backdrop-blur-md">
        <div className="w-12 h-12 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-2xl flex-shrink-0">
          🏆
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold block">
            ¡Logro Desbloqueado!
          </span>
          <h4 className="text-sm font-bold text-white truncate">{current.name}</h4>
          <p className="text-xs text-neutral-400 truncate">{current.description}</p>
        </div>
      </div>
    </div>
  );
}
