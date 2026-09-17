import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SessionComplete } from "../components/SessionComplete";

describe("SessionComplete", () => {
  it("renders celebratory dialog and statistics", () => {
    const handleContinue = vi.fn();
    render(
      <SessionComplete
        wpm={75}
        accuracy={98}
        onContinue={handleContinue}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("¡Sesión Completada!")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByText("98%")).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /continuar/i });
    fireEvent.click(button);
    expect(handleContinue).toHaveBeenCalledTimes(1);
  });
});
