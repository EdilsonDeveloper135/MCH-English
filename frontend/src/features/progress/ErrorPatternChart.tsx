"use client";

import React, { memo } from "react";
import type { ErrorCharStatDTO } from "@/types";

interface ErrorPatternChartProps {
  data: ErrorCharStatDTO[];
}

export const ErrorPatternChart = memo(function ErrorPatternChart({
  data,
}: ErrorPatternChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-center text-neutral-500 text-sm">
        No se han registrado patrones de errores todavía.
      </div>
    );
  }

  const items = data.slice(0, 10);
  const maxCount = Math.max(...items.map((i) => i.count), 1);

  const barHeight = 22;
  const gap = 10;
  const labelWidth = 45;
  const countWidth = 50;
  const totalWidth = 550;
  const barAreaWidth = totalWidth - labelWidth - countWidth;
  const totalHeight = items.length * (barHeight + gap) + 20;

  const formatCharDisplay = (c: string) => {
    if (c === " ") return "␣ (espacio)";
    return `'${c}'`;
  };

  return (
    <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800/90 shadow-xl space-y-3">
      <div>
        <h2 className="text-base font-semibold text-white tracking-tight">
          Patrones de Error (Top 10 Caracteres)
        </h2>
        <p className="text-xs text-neutral-400">Teclas con mayor número de fallos acumulados</p>
      </div>

      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label={`Gráfico de barras de los 10 caracteres con más errores. Carácter con más errores: ${items[0]?.char} con ${items[0]?.count} fallos.`}
        >
          <defs>
            <linearGradient id="errorBarGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#f87171" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          {items.map((item, idx) => {
            const y = 10 + idx * (barHeight + gap);
            const barWidth = Math.max(4, (item.count / maxCount) * barAreaWidth);
            const charLabel = item.char === " " ? "␣" : item.char;

            return (
              <g key={item.char + idx} className="group">
                {/* Character Label */}
                <text
                  x={labelWidth - 10}
                  y={y + barHeight / 2 + 4}
                  textAnchor="end"
                  className="fill-neutral-300 font-mono text-xs font-semibold"
                >
                  {charLabel}
                </text>

                {/* Background track */}
                <rect
                  x={labelWidth}
                  y={y}
                  width={barAreaWidth}
                  height={barHeight}
                  rx={4}
                  fill="#171717"
                  stroke="#262626"
                  strokeWidth="0.5"
                />

                {/* Value Bar */}
                <rect
                  x={labelWidth}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={4}
                  fill="url(#errorBarGradient)"
                  className="transition-all duration-300"
                />

                {/* Count Label */}
                <text
                  x={labelWidth + barWidth + 8}
                  y={y + barHeight / 2 + 4}
                  textAnchor="start"
                  className="fill-neutral-400 font-mono text-[11px]"
                >
                  {item.count}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Accessible Data Table for WCAG 1.1.1 */}
        <table className="sr-only">
          <caption>Tabla de caracteres con más errores frecuentes</caption>
          <thead>
            <tr>
              <th scope="col">Carácter</th>
              <th scope="col">Total de Errores</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.char}>
                <td>{formatCharDisplay(item.char)}</td>
                <td>{item.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
