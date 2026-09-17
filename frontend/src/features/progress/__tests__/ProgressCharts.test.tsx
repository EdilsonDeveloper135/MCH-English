import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WpmTrendChart } from "../WpmTrendChart";
import { AccuracyHeatmap } from "../AccuracyHeatmap";
import { ErrorPatternChart } from "../ErrorPatternChart";
import { SessionHistoryTable } from "../SessionHistoryTable";

describe("ProgressCharts and Components", () => {
  it("renders WpmTrendChart with role='img' and accessible table", () => {
    const data = [
      { date: "10/09 10:00", wpm: 55, accuracy: 95 },
      { date: "11/09 11:00", wpm: 65, accuracy: 97 },
    ];
    render(<WpmTrendChart data={data} />);

    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByText("Tendencia de Velocidad (WPM)")).toBeInTheDocument();
    // Screen reader accessible table
    expect(screen.getByText("Historial de WPM de las últimas sesiones")).toBeInTheDocument();
  });

  it("renders AccuracyHeatmap with role='img' and legend", () => {
    const data = [
      { date: "2026-09-10", sessions: 3, avg_wpm: 60, avg_accuracy: 92 },
      { date: "2026-09-11", sessions: 1, avg_wpm: 58, avg_accuracy: 75 },
    ];
    render(<AccuracyHeatmap data={data} days={14} />);

    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByText("Mapa de Precisión Diaria")).toBeInTheDocument();
  });

  it("renders ErrorPatternChart with top erroneous characters", () => {
    const errorChars = [
      { char: "e", count: 15 },
      { char: "t", count: 12 },
      { char: " ", count: 8 },
    ];
    render(<ErrorPatternChart data={errorChars} />);

    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByText("Patrones de Error (Top 10 Caracteres)")).toBeInTheDocument();
    expect(screen.getAllByText("15").length).toBeGreaterThan(0);
    expect(screen.getAllByText("12").length).toBeGreaterThan(0);
  });

  it("renders SessionHistoryTable with sorting and pagination", () => {
    const sessions = [
      {
        id: "s1",
        date: "2026-09-10 12:00",
        text_title: "Hamlet",
        wpm: 65,
        accuracy: 98,
        errors: 2,
        duration_seconds: 45,
        xp_earned: 225,
      },
      {
        id: "s2",
        date: "2026-09-11 15:00",
        text_title: "Macbeth",
        wpm: 75,
        accuracy: 99,
        errors: 1,
        duration_seconds: 40,
        xp_earned: 250,
      },
    ];
    render(<SessionHistoryTable sessions={sessions} />);

    expect(screen.getByText("Historial de Sesiones")).toBeInTheDocument();
    expect(screen.getByText("Hamlet")).toBeInTheDocument();
    expect(screen.getByText("Macbeth")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /exportar csv/i })).toBeInTheDocument();
  });
});
