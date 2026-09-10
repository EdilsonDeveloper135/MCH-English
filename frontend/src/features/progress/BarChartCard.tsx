"use client";

import { EmptyState } from "./EmptyState";

interface Bar {
  label: string;
  value: number;
}

interface BarChartCardProps {
  title: string;
  bars: Bar[];
  unit?: string;
  emptyWhenAllZero?: boolean;
}

const WIDTH = 600;
const HEIGHT = 160;
const PAD = 24;

export function BarChartCard({ title, bars, unit = "", emptyWhenAllZero = false }: BarChartCardProps) {
  const isEmpty = bars.length === 0 || (emptyWhenAllZero && bars.every((b) => b.value === 0));

  return (
    <div className="border border-gray-800 rounded p-4">
      <p className="text-xs text-gray-400 mb-3">{title}</p>
      {isEmpty ? <EmptyState /> : <Chart bars={bars} unit={unit} />}
    </div>
  );
}

function Chart({ bars, unit }: { bars: Bar[]; unit: string }) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  const slot = (WIDTH - PAD * 2) / bars.length;
  const barWidth = Math.min(slot * 0.6, 48);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-40" preserveAspectRatio="none">
      {bars.map((b, i) => {
        const barHeight = (b.value / max) * (HEIGHT - PAD * 2 - 12);
        const x = PAD + i * slot + (slot - barWidth) / 2;
        const y = HEIGHT - PAD - 12 - barHeight;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 1)} fill="#fff">
              <title>{`${b.label}: ${b.value}${unit}`}</title>
            </rect>
            <text x={x + barWidth / 2} y={HEIGHT - PAD} fontSize="9" fill="#6b7280" textAnchor="middle">
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
