"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import type { OverviewStatsDTO } from "@/types";

export default function ProgressPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const [stats, setStats] = useState<OverviewStatsDTO | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    api.getOverview().then(setStats);
  }, [hasHydrated, token, router]);

  return (
    <div className="min-h-screen px-6 py-10 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-white">Progress</h1>
        <div className="flex gap-4 text-sm text-gray-400">
          <Link href="/vocabulary" className="hover:text-white">
            Vocabulary
          </Link>
          <Link href="/library" className="hover:text-white">
            Library
          </Link>
        </div>
      </div>

      {!stats ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Stat label="Sesiones completadas" value={stats.total_sessions} />
          <Stat label="Tiempo practicado" value={`${Math.round(stats.total_practice_seconds / 60)} min`} />
          <Stat label="WPM promedio" value={stats.average_wpm} />
          <Stat label="Mejor WPM" value={stats.best_wpm} />
          <Stat label="Precision promedio" value={`${stats.average_accuracy}%`} />
          <Stat label="Textos listos" value={`${stats.texts_ready} / ${stats.texts_count}`} />
          <Stat label="Precision en Recall" value={`${stats.average_recall_accuracy}%`} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-gray-800 rounded p-4">
      <p className="text-2xl text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
