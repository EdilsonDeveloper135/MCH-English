"use client";

import { useMemo } from "react";
import { useTypingStore } from "@/stores/typingStore";

export interface GhostRacerProps {
  currentProgress: number;
  textId: string;
  chunkIndex: number;
  elapsedMs: number;
}

export function GhostRacer({ currentProgress, textId, chunkIndex, elapsedMs }: GhostRacerProps) {
  const ghostDataMap = useTypingStore((state) => state.ghostData);
  const key = `${textId}-${chunkIndex}`;
  const ghostData = ghostDataMap?.[key];

  const bestProgress = useMemo(() => {
    if (!ghostData || !ghostData.keystrokePositions || ghostData.keystrokePositions.length === 0) {
      return 0;
    }

    const positions = ghostData.keystrokePositions;
    
    // Find the latest position recorded before or exactly at elapsedMs
    let interpolatedProgress = 0;
    for (let i = positions.length - 1; i >= 0; i--) {
      const pos = positions[i];
      if (pos.time <= elapsedMs) {
        if (pos.progress !== undefined) {
          interpolatedProgress = pos.progress;
        } else if (ghostData.totalChars && ghostData.totalChars > 0) {
          interpolatedProgress = (pos.charIndex / ghostData.totalChars) * 100;
        } else {
          interpolatedProgress = pos.charIndex;
        }
        break;
      }
    }

    // If it's fully complete or not started
    if (elapsedMs <= positions[0].time) return 0;
    if (elapsedMs >= positions[positions.length - 1].time) return 100;

    return Math.min(100, Math.max(0, interpolatedProgress));
  }, [ghostData, elapsedMs]);

  if (!ghostData) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 w-full max-w-md mx-auto my-2 opacity-80 hover:opacity-100 transition-opacity">
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="w-10 text-right text-amber-400 font-medium tracking-wide">YOU</span>
        <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-amber-400 rounded-full transition-[width] duration-200 ease-out" 
            style={{ width: `${Math.max(0, Math.min(100, currentProgress))}%` }}
          />
        </div>
      </div>
      
      <div className="flex items-center gap-2 text-xs font-mono">
        <span className="w-10 text-right text-gray-500 font-medium tracking-wide">BEST</span>
        <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gray-500 rounded-full transition-[width] duration-200 ease-out" 
            style={{ width: `${Math.max(0, Math.min(100, bestProgress))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
