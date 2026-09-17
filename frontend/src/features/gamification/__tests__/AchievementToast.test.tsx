import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AchievementToast } from "../AchievementToast";

describe("AchievementToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when no achievements are provided", () => {
    const { container } = render(<AchievementToast achievements={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders achievement details with polite aria-live and alert role", () => {
    const mockAchievements = [
      {
        id: "first_blood",
        name: "Primer Paso",
        description: "Completa tu primera sesión",
      },
    ];

    render(<AchievementToast achievements={mockAchievements} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("¡Logro Desbloqueado!")).toBeInTheDocument();
    expect(screen.getByText("Primer Paso")).toBeInTheDocument();
    expect(screen.getByText("Completa tu primera sesión")).toBeInTheDocument();
  });

  it("auto-dismisses and invokes onDismiss callback after 3000ms", () => {
    const onDismiss = vi.fn();
    const mockAchievements = [
      {
        id: "speed_demon_40",
        name: "Rápido y Furioso",
        description: "Alcanza 40 WPM",
      },
    ];

    render(<AchievementToast achievements={mockAchievements} onDismiss={onDismiss} />);

    expect(screen.getByText("Rápido y Furioso")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Rápido y Furioso")).not.toBeInTheDocument();
  });
});
