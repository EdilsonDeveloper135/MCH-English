"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import type { AchievementItemDTO } from "@/types";

export default function AchievementsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [achievements, setAchievements] = useState<AchievementItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }

    let isMounted = true;
    api
      .getAchievements()
      .then(async (data) => {
        if (!isMounted) return;
        setAchievements(data);
        setLoading(false);

        // If there are unseen achievements, mark them as seen
        const hasUnseen = data.some((a) => a.unlocked_at && !a.seen);
        if (hasUnseen) {
          try {
            await api.markAchievementsSeen();
          } catch {
            // non-fatal
          }
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setError("No se pudieron cargar los logros.");
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [hasHydrated, token, router]);

  const unlockedCount = achievements.filter((a) => a.unlocked_at).length;
  const progressPercent =
    achievements.length > 0 ? (unlockedCount / achievements.length) * 100 : 0;

  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>🏆</span> Galería de Logros
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Desbloquea medallas reforzando tus hábitos y superando tus récords.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-neutral-900/80 px-4 py-2 rounded-xl border border-neutral-800 font-mono text-xs">
          <span className="text-neutral-400">Progreso:</span>
          <span className="font-bold text-amber-400">
            {unlockedCount} / {achievements.length}
          </span>
          <div className="w-20 h-1.5 bg-neutral-800 rounded-full overflow-hidden ml-1">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-6 bg-red-950/40 border border-red-900/60 rounded-xl text-center text-red-300 text-sm">
          {error}
        </div>
      ) : loading ? (
        <div className="py-20 text-center font-mono text-neutral-500 text-sm animate-pulse">
          Cargando catálogo de medallas y logros...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map((item) => {
            const isUnlocked = Boolean(item.unlocked_at);
            const formattedDate = item.unlocked_at
              ? new Date(item.unlocked_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : null;

            return (
              <div
                key={item.id}
                className={`relative rounded-2xl p-5 border transition-all duration-200 overflow-hidden ${
                  isUnlocked
                    ? "bg-neutral-900/90 border-amber-500/40 shadow-lg shadow-amber-950/20 hover-shimmer cursor-pointer"
                    : "bg-neutral-950/60 border-neutral-850 opacity-45 grayscale"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border ${
                      isUnlocked
                        ? "bg-amber-400/10 border-amber-400/30 text-amber-300 shadow-inner"
                        : "bg-neutral-900 border-neutral-800 text-neutral-600"
                    }`}
                  >
                    {isUnlocked ? "🏆" : "🔒"}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h3
                        className={`text-sm font-bold truncate ${
                          isUnlocked ? "text-white" : "text-neutral-400"
                        }`}
                      >
                        {item.name}
                      </h3>
                      {isUnlocked && (
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                          Desbloqueado
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-neutral-400 line-clamp-2">
                      {item.description}
                    </p>

                    {isUnlocked && formattedDate && (
                      <p className="text-[10px] font-mono text-neutral-500 pt-1">
                        Obtenido el {formattedDate}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
