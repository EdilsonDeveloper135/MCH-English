"use client";

import React, { memo, useState, useMemo } from "react";
import type { SessionHistoryItemDTO } from "@/types";
import { downloadSessionsCsv } from "./utils/csvExport";

interface SessionHistoryTableProps {
  sessions: SessionHistoryItemDTO[];
}

type SortField = "date" | "text_title" | "wpm" | "accuracy" | "errors" | "xp_earned";
type SortOrder = "asc" | "desc";

const PAGE_SIZE = 10;

export const SessionHistoryTable = memo(function SessionHistoryTable({
  sessions,
}: SessionHistoryTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const sortedSessions = useMemo(() => {
    const list = [...sessions];
    list.sort((a, b) => {
      let aVal: string | number = a[sortField];
      let bVal: string | number = b[sortField];

      if (typeof aVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }

      return sortOrder === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    return list;
  }, [sessions, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedSessions.length / PAGE_SIZE));
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedSessions.slice(start, start + PAGE_SIZE);
  }, [sortedSessions, currentPage]);

  const handleExportCsv = () => {
    downloadSessionsCsv(sessions);
  };

  if (sessions.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-center text-neutral-500 text-sm">
        No hay sesiones completadas registradas en el historial.
      </div>
    );
  }

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return <span className="opacity-30 ml-1">↕</span>;
    return <span className="text-cyan-400 ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800/90 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight">
            Historial de Sesiones
          </h2>
          <p className="text-xs text-neutral-400">
            Últimas {sessions.length} sesiones de práctica
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/60 transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          title="Descargar historial completo en archivo CSV"
        >
          <span>📥</span> Exportar CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono" aria-label="Historial de sesiones">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-400 select-none">
              <th
                scope="col"
                className="py-2.5 px-3 cursor-pointer hover:text-white"
                onClick={() => handleSort("date")}
                aria-sort={sortField === "date" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
              >
                Fecha {renderSortIndicator("date")}
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 cursor-pointer hover:text-white"
                onClick={() => handleSort("text_title")}
                aria-sort={sortField === "text_title" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
              >
                Texto {renderSortIndicator("text_title")}
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 cursor-pointer hover:text-white text-right"
                onClick={() => handleSort("wpm")}
                aria-sort={sortField === "wpm" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
              >
                WPM {renderSortIndicator("wpm")}
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 cursor-pointer hover:text-white text-right"
                onClick={() => handleSort("accuracy")}
                aria-sort={sortField === "accuracy" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
              >
                Precisión {renderSortIndicator("accuracy")}
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 cursor-pointer hover:text-white text-right"
                onClick={() => handleSort("errors")}
                aria-sort={sortField === "errors" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
              >
                Errores {renderSortIndicator("errors")}
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 cursor-pointer hover:text-white text-right"
                onClick={() => handleSort("xp_earned")}
                aria-sort={sortField === "xp_earned" ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
              >
                XP {renderSortIndicator("xp_earned")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-850">
            {paginatedSessions.map((session) => (
              <tr
                key={session.id}
                className="hover:bg-neutral-800/40 transition-colors text-neutral-300"
              >
                <td className="py-2.5 px-3 text-neutral-400 whitespace-nowrap">{session.date}</td>
                <td className="py-2.5 px-3 text-white font-sans max-w-[180px] truncate" title={session.text_title}>
                  {session.text_title}
                </td>
                <td className="py-2.5 px-3 text-right font-semibold text-white">{session.wpm}</td>
                <td className="py-2.5 px-3 text-right text-emerald-400">{session.accuracy}%</td>
                <td className="py-2.5 px-3 text-right text-red-400">{session.errors}</td>
                <td className="py-2.5 px-3 text-right text-amber-400 font-semibold">+{session.xp_earned}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-neutral-800 text-xs font-mono text-neutral-400">
          <span>
            Página {currentPage} de {totalPages}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
