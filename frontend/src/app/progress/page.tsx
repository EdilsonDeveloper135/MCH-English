"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import { LineChartCard } from "@/features/progress/LineChartCard";
import { BarChartCard } from "@/features/progress/BarChartCard";
import { WeakWordsChart } from "@/features/progress/WeakWordsChart";
import type { HistoryPointDTO, OverviewStatsDTO, VocabularyBucketDTO, VocabularyItemDTO } from "@/types";

function formatDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

export default function ProgressPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [stats, setStats] = useState<OverviewStatsDTO | null>(null);
  const [history, setHistory] = useState<HistoryPointDTO[] | null>(null);
  const [distribution, setDistribution] = useState<VocabularyBucketDTO[] | null>(null);
  const [weakWords, setWeakWords] = useState<VocabularyItemDTO[] | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    api.getOverview().then(setStats);
    api.getHistory().then(setHistory);
    api.getVocabularyDistribution().then(setDistribution);
    api.getWeakWords().then(setWeakWords);
  }, [hasHydrated, token, router]);

  const loading = !stats || !history || !distribution || !weakWords;

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

      {loading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : (
        <div className="space-y-10">
          <section>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Typing</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Stat label="WPM actual" value={stats.current_wpm} />
              <Stat label="WPM promedio" value={stats.average_wpm} />
              <Stat label="Mejor WPM" value={stats.best_wpm} />
              <Stat label="Precision promedio" value={`${stats.average_accuracy}%`} />
              <Stat label="Tiempo practicado" value={`${Math.round(stats.total_practice_seconds / 60)} min`} />
              <Stat label="Errores" value={stats.total_errors} />
            </div>
          </section>

          <section>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">English</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Stat label="Palabras encontradas" value={stats.words_encountered} />
              <Stat label="Palabras aprendidas" value={stats.words_learned} />
              <Stat label="Palabras debiles" value={stats.weak_words_count} />
              <Stat label="Precision en Recall" value={`${stats.average_recall_accuracy}%`} />
              <Stat label="Precision en Dictation" value={`${stats.average_dictation_accuracy}%`} />
              <Stat label="Oraciones completadas" value={stats.sentences_completed} />
            </div>
          </section>

          <section>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Stat label="Sesiones completadas" value={stats.total_sessions} />
              <Stat label="Textos listos" value={`${stats.texts_ready} / ${stats.texts_count}`} />
            </div>
          </section>

          <section>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Graficos</p>
            <div className="grid gap-4">
              <LineChartCard
                title="WPM en el tiempo"
                points={history.map((h) => ({ label: formatDay(h.date), value: h.average_wpm }))}
              />
              <LineChartCard
                title="Precision en el tiempo"
                points={history.map((h) => ({ label: formatDay(h.date), value: h.average_accuracy }))}
                unit="%"
              />
              <BarChartCard
                title="Tiempo de practica (min/dia)"
                bars={history.map((h) => ({ label: formatDay(h.date), value: Math.round(h.practice_seconds / 60) }))}
              />
              <BarChartCard
                title="Dominio de vocabulario"
                bars={distribution.map((b) => ({ label: b.range, value: b.count }))}
                emptyWhenAllZero
              />
              <WeakWordsChart items={weakWords} />
            </div>
          </section>
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
