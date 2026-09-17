/**
 * Pure SVG Math utilities for charts (no external libraries like recharts or d3).
 */

export interface Point {
  x: number;
  y: number;
}

export function min(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.min(...values);
}

export function max(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values);
}

export function normalize(
  value: number,
  minVal: number,
  maxVal: number,
  targetMin: number,
  targetMax: number
): number {
  if (maxVal === minVal) return (targetMin + targetMax) / 2;
  const clamped = Math.max(minVal, Math.min(value, maxVal));
  const ratio = (clamped - minVal) / (maxVal - minVal);
  return targetMin + ratio * (targetMax - targetMin);
}

/**
 * Builds an SVG cubic-bezier or line path string from 2D points.
 */
export function buildLinePath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    // Smooth curve control points
    const cp1x = prev.x + (curr.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (curr.x - prev.x) / 2;
    const cp2y = curr.y;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }
  return d;
}

/**
 * Builds an SVG closed area path for area fill under a line chart.
 */
export function buildAreaPath(points: Point[], baseY: number): string {
  if (points.length < 2) return "";
  const line = buildLinePath(points);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  return `${line} L ${lastPoint.x} ${baseY} L ${firstPoint.x} ${baseY} Z`;
}
