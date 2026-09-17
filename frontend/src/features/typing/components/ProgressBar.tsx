"use client";

import React, { memo } from 'react';

interface ProgressBarProps {
  percent: number;
  mode?: 'progress' | 'countdown';
  remaining?: number;
}

export const ProgressBar = memo(function ProgressBar({
  percent,
  mode = 'progress',
  remaining = 0,
}: ProgressBarProps) {
  const clampedPercent = Math.min(Math.max(percent, 0), 100);

  return (
    <div className="fixed top-0 left-0 w-full h-[2px] bg-gray-800 z-50">
      <div 
        className="h-full w-full bg-gradient-to-r from-cyan-500 to-green-500 transition-transform duration-150 ease-out will-change-transform origin-left"
        style={{ transform: `scaleX(${clampedPercent / 100})` }}
      />
      {mode === 'countdown' && remaining > 0 && (
        <div className="absolute top-1 right-2 text-xs font-mono text-gray-500 opacity-70">
          {Math.ceil(remaining)}s
        </div>
      )}
    </div>
  );
});
