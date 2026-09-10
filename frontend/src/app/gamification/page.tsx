"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import { LevelBar } from "@/features/gamification/LevelBar";
import { StreakCard } from "@/features/gamification/StreakCard";
import { AchievementGrid } from "@/features/gamification/AchievementGrid";
import type { GamificationOverviewDTO } from "@/types";

export default function GamificationPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [overview, setOverview] = useState<GamificationOverviewDTO | null>(null);
  const [goalDraft, setGoalDraft] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getGamificationOverview();
      setOverview(data);
    } catch {
      setError("No se pudo cargar la información de gamificación.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, token, router]);

  async function saveGoal() {
    const minutes = parseInt(goalDraft, 10);
    if (!minutes || minutes < 1) return;
    setSavingGoal(true);
    try {
      await api.updateSettings({ daily_goal_minutes: minutes });
      await refresh();
    } finally {
      setSavingGoal(false);
    }
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-white mb-8">Gamification</h1>

      {error ? (
        <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-6 text-center my-8">
          <p className="text-red-300 text-sm mb-4">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="bg-white text-black text-xs font-semibold px-4 py-2 rounded-lg hover:bg-neutral-200 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            Reintentar conexión
          </button>
        </div>
      ) : loading || !overview ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : (
        <div className="space-y-8">
          <LevelBar
            level={overview.level}
            xpIntoLevel={overview.xp_into_level}
            xpForNextLevel={overview.xp_for_next_level}
          />

          <StreakCard currentStreak={overview.current_streak} longestStreak={overview.longest_streak} />

          <div className="border border-gray-800 rounded p-4">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-sm text-gray-400">Objetivo diario</p>
              <p className="text-xs text-gray-400">
                {Math.round(overview.practice_seconds_today / 60)} / {overview.daily_goal_minutes} min
              </p>
            </div>
            <div className="h-2 bg-gray-900 rounded overflow-hidden mb-3">
              <div
                className="h-full bg-white"
                style={{
                  width: `${Math.min((overview.practice_seconds_today / 60 / overview.daily_goal_minutes) * 100, 100)}%`,
                }}
              />
            </div>
            <div className="flex gap-2">
              <label htmlFor="daily-goal-minutes" className="sr-only">
                Objetivo diario en minutos
              </label>
              <input
                id="daily-goal-minutes"
                type="number"
                min={1}
                max={480}
                placeholder={`${overview.daily_goal_minutes}`}
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                className="w-24 bg-gray-900 border border-gray-800 rounded px-2 py-1 text-white text-xs"
              />
              <button onClick={saveGoal} disabled={savingGoal} className="text-xs underline text-gray-400">
                Cambiar objetivo (min/dia)
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Logros</p>
            <AchievementGrid achievements={overview.achievements} />
          </div>
        </div>
      )}
    </div>
  );
}
