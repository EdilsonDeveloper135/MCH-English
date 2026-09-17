import { describe, it, expect } from "vitest";
import { min, max, normalize, buildLinePath, buildAreaPath } from "../utils/chartMath";

describe("chartMath", () => {
  it("calculates min and max correctly", () => {
    expect(min([10, 5, 20])).toBe(5);
    expect(max([10, 5, 20])).toBe(20);
    expect(min([])).toBe(0);
    expect(max([])).toBe(0);
  });

  it("normalizes values into target coordinate ranges", () => {
    expect(normalize(15, 10, 20, 0, 100)).toBe(50);
    expect(normalize(10, 10, 20, 0, 100)).toBe(0);
    expect(normalize(20, 10, 20, 0, 100)).toBe(100);
    // handles equal min and max
    expect(normalize(10, 10, 10, 0, 100)).toBe(50);
  });

  it("builds line and area SVG paths", () => {
    const points = [
      { x: 0, y: 10 },
      { x: 50, y: 20 },
      { x: 100, y: 15 },
    ];
    const line = buildLinePath(points);
    expect(line).toContain("M 0 10");
    expect(line).toContain("C");

    const area = buildAreaPath(points, 200);
    expect(area).toContain("M 0 10");
    expect(area).toContain("L 100 200 L 0 200 Z");
  });
});
