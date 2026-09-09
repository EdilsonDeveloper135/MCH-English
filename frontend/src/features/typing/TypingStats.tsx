"use client";

interface TypingStatsProps {
  wpm: number;
  accuracy: number;
  progressPercent: number;
}

export function TypingStats({ wpm, accuracy, progressPercent }: TypingStatsProps) {
  return (
    <div className="flex items-center justify-between text-sm text-gray-400 mb-8">
      <div className="flex gap-6 font-mono">
        <span>{wpm} WPM</span>
        <span>{accuracy}%</span>
      </div>
      <div className="w-40 h-1 bg-gray-800 rounded overflow-hidden">
        <div
          className="h-full bg-cyan-400 transition-[width] duration-150"
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>
    </div>
  );
}
