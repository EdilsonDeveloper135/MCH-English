"use client";

import React, { memo } from "react";

interface StreakBarProps {
  streak: number;
  maxStreakTarget?: number;
  className?: string;
}

export const StreakBar = memo(function StreakBar({
  streak,
  maxStreakTarget = 50,
  className = "",
}: StreakBarProps) {
  const percentage = Math.min(100, Math.max(0, (streak / maxStreakTarget) * 100));

  // Color intensity tier based on streak count
  let tierColor = "bg-slate-500 text-slate-400 border-slate-700";
  let barColor = "bg-slate-400";
  let glowClass = "";

  if (streak >= 25) {
    tierColor = "bg-amber-500 text-amber-300 border-amber-500/30";
    barColor = "bg-gradient-to-r from-emerald-400 to-amber-400";
    glowClass = "shadow-[0_0_12px_rgba(245,158,11,0.35)]";
  } else if (streak >= 10) {
    tierColor = "bg-emerald-500 text-emerald-400 border-emerald-500/30";
    barColor = "bg-emerald-400";
    glowClass = "shadow-[0_0_8px_rgba(52,211,153,0.25)]";
  }

  return (
    <div
      className={`flex items-center gap-2.5 text-xs font-mono select-none ${className}`}
      role="group"
      aria-label="Indicador de racha"
    >
      <div className="flex items-center gap-1.5 min-w-[65px]">
        <span
          className={`inline-block w-2 h-2 rounded-full transition-colors duration-200 ${
            streak > 0 ? (streak >= 25 ? "bg-amber-400" : streak >= 10 ? "bg-emerald-400" : "bg-slate-400") : "bg-neutral-600"
          }`}
          aria-hidden="true"
        />
        <span className={`font-semibold transition-colors duration-200 ${streak > 0 ? tierColor.split(" ")[1] : "text-neutral-500"}`}>
          {streak}
        </span>
        <span className="text-neutral-500 text-[11px]">streak</span>
      </div>

      <div
        className={`relative flex-1 h-1.5 bg-neutral-800/90 rounded-full overflow-hidden border border-neutral-700/40 min-w-[80px] max-w-[140px] ${glowClass} transition-shadow duration-300`}
        role="progressbar"
        aria-valuenow={streak}
        aria-valuemin={0}
        aria-valuemax={maxStreakTarget}
        aria-label="Racha de teclas consecutivas"
      >
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-150 ease-out ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
});
