import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppHeader } from "../AppHeader";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";

let currentPathname = "/library";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/services/api", () => ({
  api: {
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("AppHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: "fake-jwt", email: "test@example.com" });
    currentPathname = "/library";
  });

  it("renders nothing when user is not authenticated", () => {
    useAuthStore.setState({ token: null, email: null });
    const { container } = render(<AppHeader />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing on hidden paths such as /login or /register", () => {
    currentPathname = "/login";
    const { container } = render(<AppHeader />);
    expect(container.firstChild).toBeNull();
  });

  it("renders minimal exit banner during practice session", () => {
    currentPathname = "/practice/text-123";
    render(<AppHeader />);
    expect(screen.getByText(/Salir \/ Volver a Biblioteca/i)).toBeInTheDocument();
    expect(screen.queryByText("MCH English")).not.toBeInTheDocument();
  });

  it("renders full navigation links on main pages and highlights active page", () => {
    currentPathname = "/library";
    render(<AppHeader />);
    expect(screen.getByText("MCH English")).toBeInTheDocument();
    const libraryLink = screen.getAllByRole("link", { name: "Library" })[0];
    expect(libraryLink).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link", { name: "Vocabulary" })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Progress" })[0]).toBeInTheDocument();
  });

  it("toggles mobile hamburger menu and closes on Escape", () => {
    render(<AppHeader />);
    const toggleButton = screen.getByLabelText(/Abrir menú de navegación/i);
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    // Open menu
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: /Menú de navegación móvil/i })).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape" });
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
  });

  it("invokes api.logout and clears auth state when clicking Salir", async () => {
    render(<AppHeader />);
    const logoutButtons = screen.getAllByRole("button", { name: /Salir/i });
    fireEvent.click(logoutButtons[0]);

    await waitFor(() => {
      expect(api.logout).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().token).toBeNull();
    });
  });
});
