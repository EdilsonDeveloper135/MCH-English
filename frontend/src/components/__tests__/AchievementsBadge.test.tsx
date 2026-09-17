import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AchievementsBadge } from "../AchievementsBadge";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";

vi.mock("@/services/api", () => ({
  api: {
    getAchievements: vi.fn(),
  },
}));

describe("AchievementsBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: "test-token" });
  });

  it("renders base trophy link without notification badge when no unseen achievements exist", async () => {
    (api.getAchievements as any).mockResolvedValue([
      {
        id: "first_blood",
        name: "Primer Paso",
        description: "Completa tu primera sesión",
        unlocked_at: "2024-01-01T00:00:00Z",
        seen: true,
      },
      {
        id: "streak_3",
        name: "En Racha",
        description: "Racha de 3 días",
        unlocked_at: null,
        seen: false,
      },
    ]);

    render(<AchievementsBadge />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Ver logros y medallas" })).toBeInTheDocument();
    });

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("displays number of unseen achievements and custom aria-label", async () => {
    (api.getAchievements as any).mockResolvedValue([
      {
        id: "first_blood",
        name: "Primer Paso",
        description: "Completa tu primera sesión",
        unlocked_at: "2024-01-01T00:00:00Z",
        seen: false,
      },
      {
        id: "speed_demon_40",
        name: "Rápido y Furioso",
        description: "40 WPM",
        unlocked_at: "2024-01-02T00:00:00Z",
        seen: false,
      },
      {
        id: "centurion",
        name: "Centurión",
        description: "100 sesiones",
        unlocked_at: null,
        seen: false,
      },
    ]);

    render(<AchievementsBadge />);

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "2 logros nuevos por revisar" })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
