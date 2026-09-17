import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StreakBar } from "../components/StreakBar";

describe("StreakBar", () => {
  it("renders with 0 streak and has accessible progressbar attributes", () => {
    render(<StreakBar streak={0} maxStreakTarget={50} />);
    const progressbar = screen.getByRole("progressbar", { name: /racha de teclas consecutivas/i });
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute("aria-valuenow", "0");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "50");
  });

  it("updates value and percentage as streak grows", () => {
    render(<StreakBar streak={25} maxStreakTarget={50} />);
    const progressbar = screen.getByRole("progressbar", { name: /racha de teclas consecutivas/i });
    expect(progressbar).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("applies amber highlight for high streaks (>=25)", () => {
    const { container } = render(<StreakBar streak={30} />);
    expect(container.querySelector(".text-amber-300")).toBeInTheDocument();
  });

  it("applies emerald highlight for medium streaks (>=10 and <25)", () => {
    const { container } = render(<StreakBar streak={15} />);
    expect(container.querySelector(".text-emerald-400")).toBeInTheDocument();
  });
});
