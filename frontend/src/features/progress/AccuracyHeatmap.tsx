"use client";

import React, { memo, useState, useMemo } from "react";
import type { DailyStatSummaryDTO } from "@/types";

interface AccuracyHeatmapProps {
  data: DailyStatSummaryDTO[];
  days?: number;
}

interface HeatmapDay {
  date: string;
  dayOfWeek: number; // 0 = Mon, 6 = Sun
  accuracy: number | null;
  sessions: number;
}

export const AccuracyHeatmap = memo(function AccuracyHeatmap({
  data,
  days = 28,
}: AccuracyHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);

  // Map input data by ISO date string (YYYY-MM-DD)
  const summaryByDate = useMemo(() => {
    const map = new Map<string, DailyStatSummaryDTO>();
    for (const item of data) {
      map.set(item.date, item);
    }
    return map;
  }, [data]);

  // Generate calendar days for the last N days aligned to full weeks
  const grid = useMemo(() => {
    const today = new Date();
    const result: HeatmapDay[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      const entry = summaryByDate.get(iso);

      // 0 = Monday, ..., 6 = Sunday
      const jsDay = d.getDay();
      const dayOfWeek = (jsDay + 6) % 7;

      result.push({
        date: iso,
        dayOfWeek,
        accuracy: entry ? (entry.avg_accuracy !== undefined ? entry.avg_accuracy : 85) : null,
        sessions: entry ? entry.sessions : 0,
      });
    }

    return result;
  }, [summaryByDate, days]);

  // Group into columns (weeks)
  const weeks = useMemo(() => {
    const cols: HeatmapDay[][] = [];
    let currentWeek: HeatmapDay[] = [];

    for (const day of grid) {
      currentWeek.push(day);
      if (day.dayOfWeek === 6) {
        cols.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      cols.push(currentWeek);
    }
    return cols;
  }, [grid]);

  const getColor = (accuracy: number | null, sessions: number): string => {
    if (sessions === 0 || accuracy === null) return "#171717"; // neutral-900
    if (accuracy < 80) return "#064e3b"; // emerald-900 (verde claro/tenue)
    if (accuracy <= 90) return "#059669"; // emerald-600 (verde medio)
    return "#34d399"; // emerald-400 (verde fuerte)
  };

  const cellSize = 18;
  const cellGap = 4;
  const numWeeks = weeks.length;
  const svgWidth = numWeeks * (cellSize + cellGap) + 40;
  const svgHeight = 7 * (cellSize + cellGap) + 30;

  const dayLabels = ["L", "M", "X", "J", "V", "S", "D"];

  return (
    <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800/90 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight">
            Mapa de Precisión Diaria
          </h2>
          <p className="text-xs text-neutral-400">Consistencia y precisión en las últimas semanas</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono self-start sm:self-auto">
          <span>Menos</span>
          <span className="w-3.5 h-3.5 rounded bg-[#171717] border border-neutral-800" title="Sin sesiones" />
          <span className="w-3.5 h-3.5 rounded bg-[#064e3b]" title="< 80%" />
          <span className="w-3.5 h-3.5 rounded bg-[#059669]" title="80% - 90%" />
          <span className="w-3.5 h-3.5 rounded bg-[#34d399]" title="> 90%" />
          <span>Más</span>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-auto max-h-[180px] select-none"
          role="img"
          aria-label="Mapa de calor de precisión diaria tipo contribuciones de GitHub para las últimas semanas."
        >
          {/* Day of week row labels */}
          {dayLabels.map((lbl, rowIdx) => (
            <text
              key={lbl}
              x={12}
              y={rowIdx * (cellSize + cellGap) + cellSize - 4}
              className="fill-neutral-500 text-[10px] font-mono"
            >
              {lbl}
            </text>
          ))}

          {/* Grid Cells */}
          {weeks.map((week, colIdx) => {
            const x = 30 + colIdx * (cellSize + cellGap);
            return week.map((day) => {
              const y = day.dayOfWeek * (cellSize + cellGap);
              const fill = getColor(day.accuracy, day.sessions);
              const isHovered = hoveredDay?.date === day.date;

              return (
                <rect
                  key={day.date}
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={4}
                  fill={fill}
                  stroke={isHovered ? "#22d3ee" : "#262626"}
                  strokeWidth={isHovered ? 1.5 : 0.5}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => setHoveredDay(day)}
                  onMouseLeave={() => setHoveredDay(null)}
                />
              );
            });
          })}
        </svg>

        {hoveredDay && (
          <div className="mt-2 text-xs font-mono text-neutral-300">
            <span className="text-white font-semibold">{hoveredDay.date}</span>:{" "}
            {hoveredDay.sessions > 0 ? (
              <span>
                {hoveredDay.sessions} {hoveredDay.sessions === 1 ? "sesión" : "sesiones"} •{" "}
                <span className="text-emerald-400 font-semibold">{hoveredDay.accuracy}% precisión</span>
              </span>
            ) : (
              <span className="text-neutral-500">Sin sesiones de práctica</span>
            )}
          </div>
        )}

        {/* Accessible Data Table for WCAG 1.1.1 */}
        <table className="sr-only">
          <caption>Registro de precisión diaria</caption>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Sesiones</th>
              <th scope="col">Precisión Promedio</th>
            </tr>
          </thead>
          <tbody>
            {grid.map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td>{d.sessions}</td>
                <td>{d.accuracy !== null ? `${d.accuracy}%` : "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
