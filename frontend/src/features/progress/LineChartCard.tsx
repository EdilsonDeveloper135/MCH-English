"use client";

import { EmptyState } from "./EmptyState";

interface Point {
  label: string;
  value: number;
}

interface LineChartCardProps {
  title: string;
  points: Point[];
  unit?: string;
}

const WIDTH = 600;
const HEIGHT = 160;
const PAD = 24;

export function LineChartCard({ title, points, unit = "" }: LineChartCardProps) {
  return (
    <div className="border border-gray-800 rounded p-4">
      <p className="text-xs text-gray-400 mb-3">{title}</p>
      {points.length === 0 ? <EmptyState /> : <Chart points={points} unit={unit} />}
    </div>
  );
}

function Chart({ points, unit }: { points: Point[]; unit: string }) {
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = points.length > 1 ? (WIDTH - PAD * 2) / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: points.length > 1 ? PAD + i * stepX : WIDTH / 2,
    y: HEIGHT - PAD - ((p.value - min) / range) * (HEIGHT - PAD * 2),
    ...p,
  }));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-40" preserveAspectRatio="none">
      <polyline
        points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={3} fill="#fff">
          <title>{`${c.label}: ${c.value}${unit}`}</title>
        </circle>
      ))}
    </svg>
  );
}
