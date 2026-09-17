"use client";

import React, { memo, useState } from "react";
import type { WpmTrendPointDTO } from "@/types";
import { buildAreaPath, buildLinePath, normalize } from "./utils/chartMath";

interface WpmTrendChartProps {
  data: WpmTrendPointDTO[];
}

export const WpmTrendChart = memo(function WpmTrendChart({ data }: WpmTrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-center text-neutral-500 text-sm">
        No hay suficientes sesiones para mostrar la tendencia de WPM.
      </div>
    );
  }

  const width = 650;
  const height = 220;
  const paddingX = 40;
  const paddingTop = 25;
  const paddingBottom = 35;

  const wpmValues = data.map((d) => d.wpm);
  const minWpm = Math.max(0, Math.floor(Math.min(...wpmValues) * 0.85));
  const maxWpm = Math.max(minWpm + 20, Math.ceil(Math.max(...wpmValues) * 1.15));

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;
  const baseY = height - paddingBottom;

  const points = data.map((d, i) => {
    const x =
      data.length === 1
        ? width / 2
        : paddingX + (i / (data.length - 1)) * chartWidth;
    const y =
      baseY - normalize(d.wpm, minWpm, maxWpm, 0, chartHeight);
    return { x, y };
  });

  const linePath = buildLinePath(points);
  const areaPath = buildAreaPath(points, baseY);

  // Y-axis grid lines (3 horizontal levels)
  const yTicks = [
    minWpm,
    Math.round(minWpm + (maxWpm - minWpm) / 2),
    maxWpm,
  ];

  const hoveredPoint = hoveredIndex !== null ? data[hoveredIndex] : null;
  const hoveredCoord = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800/90 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white tracking-tight">
            Tendencia de Velocidad (WPM)
          </h2>
          <p className="text-xs text-neutral-400">Últimas {data.length} sesiones completadas</p>
        </div>
        {hoveredPoint && (
          <div className="text-xs font-mono bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800 text-cyan-400 animate-fadeIn">
            {hoveredPoint.wpm} WPM • {hoveredPoint.accuracy}% ACC • {hoveredPoint.date}
          </div>
        )}
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[240px] select-none overflow-visible"
          role="img"
          aria-label={`Gráfico de línea de WPM de las últimas ${data.length} sesiones. Mínimo: ${minWpm} WPM, Máximo: ${maxWpm} WPM.`}
        >
          <defs>
            <linearGradient id="wpmGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines and Y axis labels */}
          {yTicks.map((val) => {
            const y = baseY - normalize(val, minWpm, maxWpm, 0, chartHeight);
            return (
              <g key={val}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#262626"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-neutral-500 text-[10px] font-mono"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          {areaPath && (
            <path d={areaPath} fill="url(#wpmGradient)" className="transition-all duration-300" />
          )}

          {/* Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Interactive points */}
          {points.map((pt, i) => {
            const isHovered = i === hoveredIndex;
            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                tabIndex={0}
                onFocus={() => setHoveredIndex(i)}
                onBlur={() => setHoveredIndex(null)}
              >
                {/* Hit area */}
                <circle cx={pt.x} cy={pt.y} r="10" fill="transparent" />
                {/* Visual point */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 5 : 3}
                  className={`transition-all duration-150 ${
                    isHovered
                      ? "fill-cyan-300 stroke-cyan-400 stroke-2"
                      : "fill-cyan-400"
                  }`}
                />
              </g>
            );
          })}

          {/* X Axis simplified date labels */}
          {points.length > 1 && (
            <>
              <text
                x={points[0].x}
                y={height - 10}
                textAnchor="start"
                className="fill-neutral-500 text-[10px] font-mono"
              >
                {data[0].date}
              </text>
              <text
                x={points[points.length - 1].x}
                y={height - 10}
                textAnchor="end"
                className="fill-neutral-500 text-[10px] font-mono"
              >
                {data[data.length - 1].date}
              </text>
            </>
          )}

          {/* Hover highlight line */}
          {hoveredCoord && (
            <line
              x1={hoveredCoord.x}
              y1={paddingTop}
              x2={hoveredCoord.x}
              y2={baseY}
              stroke="#22d3ee"
              strokeDasharray="2 2"
              strokeWidth="1"
              opacity="0.6"
            />
          )}
        </svg>

        {/* Accessible Data Table for WCAG 1.1.1 */}
        <table className="sr-only">
          <caption>Historial de WPM de las últimas sesiones</caption>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">WPM</th>
              <th scope="col">Precisión</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i}>
                <td>{d.date}</td>
                <td>{d.wpm}</td>
                <td>{d.accuracy}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
