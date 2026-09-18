"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import type { VocabularyItemDTO } from "@/types";

type FilterTab = "all" | "weak" | "mastered";
type SortOption = "encounters" | "errors" | "mastery" | "alphabetical";

export default function VocabularyPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [items, setItems] = useState<VocabularyItemDTO[] | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [sortBy, setSortBy] = useState<SortOption>("errors");

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    api.getVocabulary().then(setItems).catch(() => {});
  }, [hasHydrated, token, router]);

  function handlePracticeWeak(word?: string) {
    if (word) {
      router.push(`/practice/weak-words?word=${encodeURIComponent(word)}`);
    } else {
      router.push("/practice/weak-words");
    }
  }

  const filteredItems = useMemo(() => {
    if (!items) return [];

    let result = items;

    // Filter by tab
    if (tab === "weak") {
      result = result.filter((i) => i.mastery_score < 80 || i.typing_errors > 0);
    } else if (tab === "mastered") {
      result = result.filter((i) => i.mastery_score >= 80);
    }

    // Filter by search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (i) => i.word.toLowerCase().includes(q) || (i.translation && i.translation.toLowerCase().includes(q))
      );
    }

    // Sort
    return [...result].sort((a, b) => {
      switch (sortBy) {
        case "errors":
          return b.typing_errors - a.typing_errors || a.mastery_score - b.mastery_score;
        case "mastery":
          return a.mastery_score - b.mastery_score || b.typing_errors - a.typing_errors;
        case "encounters":
          return b.encounters - a.encounters;
        case "alphabetical":
          return a.word.localeCompare(b.word);
        default:
          return 0;
      }
    });
  }, [items, tab, search, sortBy]);

  const weakCount = useMemo(() => {
    return items ? items.filter((i) => i.mastery_score < 80 || i.typing_errors > 0).length : 0;
  }, [items]);

  return (
    <div className="min-h-screen px-6 py-10 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Vocabulario</h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Registro de palabras encontradas en tus sesiones de práctica
          </p>
        </div>

        <button
          onClick={() => handlePracticeWeak()}
          className="bg-white hover:bg-neutral-200 text-black rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none flex items-center justify-center gap-1.5 shrink-0"
        >
          <span>⚡ Practicar palabras débiles</span>
          {weakCount > 0 && (
            <span className="bg-neutral-900 text-cyan-400 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {weakCount}
            </span>
          )}
        </button>
      </div>

      {!items ? (
        <p className="text-gray-400 text-sm">Cargando vocabulario...</p>
      ) : items.length === 0 ? (
        <div className="border border-neutral-800 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
          <p className="text-gray-400 text-sm">Todavía no registraste ninguna palabra. Practica un texto primero.</p>
          <button
            onClick={() => router.push("/library")}
            className="text-xs bg-neutral-900 text-cyan-400 hover:text-cyan-300 border border-neutral-700 px-4 py-2 rounded-lg font-medium transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            Ir a la Biblioteca →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Controls: Search, Tabs, and Sort */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <input
                type="search"
                placeholder="Buscar palabra o traducción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800 text-xs">
              <button
                type="button"
                onClick={() => setTab("all")}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  tab === "all" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Todas ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setTab("weak")}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  tab === "weak" ? "bg-neutral-800 text-amber-300" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Por mejorar ({weakCount})
              </button>
              <button
                type="button"
                onClick={() => setTab("mastered")}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  tab === "mastered" ? "bg-neutral-800 text-emerald-400" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Dominadas ({items.length - weakCount})
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="vocab-sort" className="text-xs text-neutral-400 shrink-0">
                Ordenar:
              </label>
              <select
                id="vocab-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
              >
                <option value="errors">Más errores</option>
                <option value="mastery">Menor dominio</option>
                <option value="encounters">Más encuentros</option>
                <option value="alphabetical">Alfabético (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {filteredItems.length === 0 ? (
            <div className="border border-neutral-800 rounded-xl p-8 text-center text-sm text-neutral-400">
              No se encontraron palabras que coincidan con los filtros.
            </div>
          ) : (
            <div className="border border-neutral-800/80 rounded-xl overflow-x-auto bg-neutral-950/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-800 text-xs">
                    <th className="py-3 px-4 font-medium">Palabra</th>
                    <th className="py-3 px-4 font-medium">Traducción</th>
                    <th className="py-3 px-4 font-medium text-right">Encuentros</th>
                    <th className="py-3 px-4 font-medium text-right">Errores</th>
                    <th className="py-3 px-4 font-medium text-right">Dominio</th>
                    <th className="py-3 px-4 font-medium text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {filteredItems.map((item) => (
                    <tr key={item.word} className="hover:bg-neutral-900/30 transition-colors">
                      <td className="py-3 px-4 text-white font-mono font-medium">{item.word}</td>
                      <td className="py-3 px-4 text-gray-400">{item.translation ?? "—"}</td>
                      <td className="py-3 px-4 text-gray-400 text-right tabular-nums">{item.encounters}</td>
                      <td className="py-3 px-4 text-right tabular-nums">
                        <span className={item.typing_errors > 0 ? "text-rose-400 font-semibold" : "text-gray-400"}>
                          {item.typing_errors}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <MasteryBar value={item.mastery_score} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handlePracticeWeak(item.word)}
                          className="text-xs text-neutral-400 hover:text-cyan-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-2.5 py-1 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                        >
                          Practicar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MasteryBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-gray-400 w-10 text-right tabular-nums text-xs">{Math.round(value)}%</span>
      <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}
