interface LevelBarProps {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

export function LevelBar({ level, xpIntoLevel, xpForNextLevel }: LevelBarProps) {
  const percent = xpForNextLevel > 0 ? (xpIntoLevel / xpForNextLevel) * 100 : 100;

  return (
    <div className="border border-gray-800 rounded p-4">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-2xl text-white">Nivel {level}</p>
        <p className="text-xs text-gray-500">
          {xpIntoLevel} / {xpForNextLevel} XP
        </p>
      </div>
      <div className="h-2 bg-gray-900 rounded overflow-hidden">
        <div className="h-full bg-white" style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}
