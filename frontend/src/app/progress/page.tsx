"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import { LineChartCard } from "@/features/progress/LineChartCard";
import { BarChartCard } from "@/features/progress/BarChartCard";
import { WeakWordsChart } from "@/features/progress/WeakWordsChart";
import { KeyboardHeatmap } from "@/features/typing/components/KeyboardHeatmap";
import { PersonalGoals } from "@/features/progress/PersonalGoals";
import type { HistoryPointDTO, OverviewStatsDTO, VocabularyBucketDTO, VocabularyItemDTO } from "@/types";

type TimeRange = "today" | "7d" | "30d" | "all";

function formatDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

export default function ProgressPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [stats, setStats] = useState<OverviewStatsDTO | null>(null);
  const [history, setHistory] = useState<HistoryPointDTO[] | null>(null);
  const [distribution, setDistribution] = useState<VocabularyBucketDTO[] | null>(null);
  const [weakWords, setWeakWords] = useState<VocabularyItemDTO[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, h, d, w] = await Promise.all([
        api.getOverview(),
        api.getHistory(),
        api.getVocabularyDistribution(),
        api.getWeakWords(),
      ]);
      setStats(s);
      setHistory(h);
      setDistribution(d);
      setWeakWords(w);
    } catch {
      setError("No se pudieron cargar las estadísticas de progreso.");
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
    loadData();
  }, [hasHydrated, token, router]);

  // Filter history based on time range
  const filteredHistory = (history || []).filter((item, index, arr) => {
    if (timeRange === "today") return index === arr.length - 1;
    if (timeRange === "7d") return index >= arr.length - 7;
    if (timeRange === "30d") return index >= arr.length - 30;
    return true; // all
  });

  return (
    <div className="min-h-screen px-6 py-10 max-w-4xl mx-auto space-y-10">
      {/* Header with Time Range Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Progreso y Rendimiento</h1>
          <p className="text-sm text-neutral-400 mt-1">Analítica detallada de velocidad, precisión y memoria muscular.</p>
        </div>

        {/* Time Period Filter */}
        <div className="flex bg-neutral-900/80 p-1 rounded-xl border border-neutral-800 text-xs font-medium self-start sm:self-auto">
          {[
            { id: "today", label: "Hoy" },
            { id: "7d", label: "7 días" },
            { id: "30d", label: "30 días" },
            { id: "all", label: "Todo" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTimeRange(tab.id as TimeRange)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                timeRange === tab.id
                  ? "bg-[var(--accent)] text-black font-semibold shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="bg-red-950/40 border border-red-900/60 rounded-xl p-6 text-center my-8">
          <p className="text-red-300 text-sm mb-4">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="bg-white text-black text-xs font-semibold px-4 py-2 rounded-lg hover:bg-neutral-200 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            Reintentar conexión
          </button>
        </div>
      ) : loading || !stats || !history || !distribution || !weakWords ? (
        <div className="py-20 text-center text-neutral-500 font-mono text-sm animate-pulse">
          Cargando métricas y análisis de teclado...
        </div>
      ) : (
        <div className="space-y-12">
          {/* Hero Performance Overview */}
          <section>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="WPM Actual" value={stats.current_wpm} subtitle="Última sesión" highlight />
              <StatCard label="WPM Promedio" value={stats.average_wpm} subtitle="Histórico general" />
              <StatCard label="Mejor WPM" value={stats.best_wpm} subtitle="Récord personal" />
              <StatCard label="Precisión Media" value={`${stats.average_accuracy}%`} subtitle="Consistencia global" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <StatCard label="Tiempo Total" value={`${Math.round(stats.total_practice_seconds / 60)} min`} />
              <StatCard label="Sesiones Completadas" value={stats.total_sessions} />
              <StatCard label="Errores Registrados" value={stats.total_errors} />
              <StatCard label="Palabras Dominadas" value={`${stats.words_learned} / ${stats.words_encountered}`} />
            </div>
          </section>

          {/* Interactive Keyboard Heatmap (Teclas Débiles) */}
          <section className="bg-neutral-950/80 border border-neutral-900 rounded-2xl p-6 shadow-xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white">Mapa de Calor del Teclado (Teclas Débiles)</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Identifica tus teclas lentas o con mayor tasa de error a partir de tus sesiones de práctica.
              </p>
            </div>
            <KeyboardHeatmap />
          </section>

          {/* Objetivos personales, medidos contra las estadísticas reales del usuario */}
          <section>
            <PersonalGoals currentWpm={stats.current_wpm} currentAccuracy={stats.average_accuracy} />
          </section>

          {/* Graphical Trends */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Evolución Gráfica</h2>
            <div className="grid gap-6">
              <LineChartCard
                title={`WPM en el tiempo (${timeRange.toUpperCase()})`}
                points={filteredHistory.map((h) => ({ label: formatDay(h.date), value: h.average_wpm }))}
              />
              <LineChartCard
                title={`Precisión en el tiempo (${timeRange.toUpperCase()})`}
                points={filteredHistory.map((h) => ({ label: formatDay(h.date), value: h.average_accuracy }))}
                unit="%"
              />
              <BarChartCard
                title={`Tiempo de práctica diario (minutos)`}
                bars={filteredHistory.map((h) => ({ label: formatDay(h.date), value: Math.round(h.practice_seconds / 60) }))}
              />
              <BarChartCard
                title="Distribución de Dominio de Vocabulario"
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

function StatCard({
  label,
  value,
  subtitle,
  highlight = false,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border rounded-xl p-4 transition-all ${
        highlight
          ? "border-[var(--accent)]/40 bg-[var(--accent)]/5"
          : "border-neutral-800/80 bg-neutral-900/30"
      }`}
    >
      <p className="text-2xl font-bold font-mono text-white tracking-tight">{value}</p>
      <p className="text-xs text-neutral-400 mt-1 font-medium">{label}</p>
      {subtitle && <p className="text-[10px] text-neutral-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}
