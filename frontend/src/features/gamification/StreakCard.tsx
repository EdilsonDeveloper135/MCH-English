interface StreakCardProps {
  currentStreak: number;
  longestStreak: number;
}

export function StreakCard({ currentStreak, longestStreak }: StreakCardProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="border border-gray-800 rounded p-4">
        <p className="text-2xl text-white">{currentStreak}</p>
        <p className="text-xs text-gray-400 mt-1">Racha actual (dias)</p>
      </div>
      <div className="border border-gray-800 rounded p-4">
        <p className="text-2xl text-white">{longestStreak}</p>
        <p className="text-xs text-gray-400 mt-1">Racha mas larga</p>
      </div>
    </div>
  );
}
