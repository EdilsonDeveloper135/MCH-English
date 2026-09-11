"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useTypingStore } from '@/stores/typingStore';

interface LiveStatsProps {
  wpm: number;
  rawWpm?: number;
  accuracy: number;
  consistency?: number;
  errors: number;
  elapsedSeconds: number;
  streak?: number;
  progressPercent: number;
  isFocused?: boolean;
}

export function LiveStats({
  wpm,
  rawWpm = 0,
  accuracy,
  consistency = 0,
  errors,
  elapsedSeconds,
  streak = 0,
  progressPercent,
  isFocused = false
}: LiveStatsProps) {
  const preferences = useTypingStore((s) => s.preferences);
  const { statsVisibility, targetWPM } = preferences;
  const displayMode = isFocused ? 'minimal' : (statsVisibility || 'normal');
  
  const [trend, setTrend] = useState<'up' | 'down' | 'same'>('same');
  const pastWpms = useRef<{time: number, wpm: number}[]>([]);

  useEffect(() => {
    const now = Date.now();
    pastWpms.current.push({ time: now, wpm });
    
    pastWpms.current = pastWpms.current.filter(entry => now - entry.time <= 5000);
    
    if (pastWpms.current.length > 0) {
      const oldWpm = pastWpms.current[0].wpm;
      if (wpm > oldWpm) setTrend('up');
      else if (wpm < oldWpm) setTrend('down');
      else setTrend('same');
    }
  }, [wpm]);

  let wpmColor = 'text-white';
  if (targetWPM) {
    if (wpm >= targetWPM) wpmColor = 'text-green-400';
    else if (wpm >= targetWPM * 0.9) wpmColor = 'text-amber-400';
    else wpmColor = 'text-red-400';
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-row items-center gap-4 text-sm text-gray-400 font-mono">
      <div className="flex items-center gap-1">
        <span className="opacity-70">wpm</span>
        <span className={`font-semibold text-lg ${wpmColor}`}>{Math.round(wpm)}</span>
        {trend === 'up' && <span className="text-green-400 text-xs">▲</span>}
        {trend === 'down' && <span className="text-red-400 text-xs">▼</span>}
      </div>

      <div className="flex items-center gap-1">
        <span className="opacity-70">acc</span>
        <span className="text-white font-semibold">{Math.round(accuracy)}%</span>
      </div>

      {displayMode !== 'minimal' && (
        <>
          <div className="flex items-center gap-1">
            <span className="opacity-70">time</span>
            <span className="text-white font-semibold">{formatTime(elapsedSeconds)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="opacity-70">err</span>
            <span className="text-white font-semibold">{errors}</span>
          </div>
        </>
      )}

      {displayMode === 'advanced' && (
        <>
          <div className="flex items-center gap-1">
            <span className="opacity-70">raw</span>
            <span className="text-white font-semibold">{Math.round(rawWpm)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="opacity-70">con</span>
            <span className="text-white font-semibold">{Math.round(consistency)}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="opacity-70">streak</span>
            <span className="text-white font-semibold">{streak}</span>
          </div>
        </>
      )}
    </div>
  );
}
