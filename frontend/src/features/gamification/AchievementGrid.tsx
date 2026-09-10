import type { AchievementDTO } from "@/types";

export function AchievementGrid({ achievements }: { achievements: AchievementDTO[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {achievements.map((a) => (
        <div
          key={a.id}
          className={`border rounded p-4 ${a.unlocked ? "border-gray-800" : "border-gray-900 bg-gray-950/40"}`}
        >
          <p className={`text-sm ${a.unlocked ? "text-white" : "text-gray-400"}`}>
            {a.unlocked ? a.name : `🔒 ${a.name}`}
          </p>
          <p className="text-xs text-gray-400 mt-1">{a.description}</p>
        </div>
      ))}
    </div>
  );
}
