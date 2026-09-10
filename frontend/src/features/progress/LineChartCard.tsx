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
        // `preserveAspectRatio="none"` above stretches X and Y independently to
        // fill the container, which turns a plain circle's radius into an ellipse
        // on any screen whose aspect ratio doesn't match the viewBox's 600x160 (the
        // common case on mobile). A near-zero-radius circle stroked with
        // vector-effect="non-scaling-stroke" renders as a uniform dot instead --
        // the stroke width is computed after undoing the parent's scale, so it
        // stays round regardless of how unevenly the chart itself is stretched.
        // (r must be a hair above 0, not exactly 0 -- a truly zero-area circle is
        // dropped from rendering entirely instead of being stroked.)
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={0.01}
          stroke="#fff"
          strokeWidth={6}
          vectorEffect="non-scaling-stroke"
          fill="none"
        >
          <title>{`${c.label}: ${c.value}${unit}`}</title>
        </circle>
      ))}
    </svg>
  );
}
