import { describe, it, expect } from "vitest";
import { generateCsvContent, type SessionExportRow } from "../utils/csvExport";

describe("csvExport", () => {
  it("formats rows into valid CSV lines with escaping", () => {
    const rows: SessionExportRow[] = [
      {
        id: "s1",
        date: "2026-09-10 12:00",
        text_title: "Hamlet, Act 1",
        wpm: 65.5,
        accuracy: 98,
        errors: 3,
        duration_seconds: 45.2,
        xp_earned: 250,
      },
      {
        id: "s2",
        date: "2026-09-11 14:00",
        text_title: 'Title with "quotes"',
        wpm: 72,
        accuracy: 99,
        errors: 1,
        duration_seconds: 30,
        xp_earned: 180,
      },
    ];

    const csv = generateCsvContent(rows);
    const lines = csv.split("\n");

    expect(lines[0]).toBe(
      "date,text_title,wpm,accuracy,errors,duration_seconds,xp_earned"
    );
    expect(lines[1]).toContain('"Hamlet, Act 1"');
    expect(lines[1]).toContain("65.5");
    expect(lines[2]).toContain('"Title with ""quotes"""');
  });
});
