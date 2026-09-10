import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";
import LibraryPage from "../library/page";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import type { TextDTO } from "@/types";

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock("@/services/api", () => ({
  api: {
    listTexts: vi.fn(),
    createText: vi.fn(),
    deleteText: vi.fn(),
  },
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

const mockTexts: TextDTO[] = [
  {
    id: "t-1",
    title: "Alice in Wonderland",
    status: "ready",
    chunk_mode: "normal",
    word_count: 500,
    chunk_count: 5,
    current_chunk_index: 0,
    current_character_index: 0,
    progress_percent: 0,
    error_message: null,
    has_translation: false,
    alignment_status: "not_provided",
    created_at: "2024-01-01T00:00:00Z",
  },
];

describe("LibraryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ token: "mock-token", hasHydrated: true });
  });

  it("renders empty state when no texts exist", async () => {
    (api.listTexts as any).mockResolvedValue([]);

    render(<LibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("Todavia no agregaste ningun texto a tu biblioteca.")).toBeInTheDocument();
    });
  });

  it("renders text items immediately when loaded", async () => {
    (api.listTexts as any).mockResolvedValue(mockTexts);

    render(<LibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice in Wonderland")).toBeInTheDocument();
      expect(screen.getByText(/500 palabras/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Practicar" })).toBeInTheDocument();
    });
  });

  it("opens create modal, submits new text, and refreshes list", async () => {
    (api.listTexts as any).mockResolvedValue(mockTexts);
    (api.createText as any).mockResolvedValue({ id: "t-2", title: "New Story" });

    render(<LibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice in Wonderland")).toBeInTheDocument();
    });

    const addBtn = screen.getByRole("button", { name: "+ Agregar Texto" });
    fireEvent.click(addBtn);

    expect(screen.getByRole("dialog", { name: "Agregar Nuevo Texto" })).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText(/ej: Alice in Wonderland/i);
    const contentInput = screen.getByPlaceholderText(/Pega aquí el texto en inglés/i);

    fireEvent.change(titleInput, { target: { value: "New Story" } });
    fireEvent.change(contentInput, { target: { value: "A short English story." } });

    fireEvent.click(screen.getByRole("button", { name: "Guardar texto" }));

    await waitFor(() => {
      expect(api.createText).toHaveBeenCalledWith(
        "New Story",
        "A short English story.",
        "normal",
        ""
      );
    });
  });

  it("opens confirm modal and deletes text", async () => {
    (api.listTexts as any).mockResolvedValue(mockTexts);
    (api.deleteText as any).mockResolvedValue(undefined);

    render(<LibraryPage />);

    await waitFor(() => {
      expect(screen.getByText("Alice in Wonderland")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole("button", { name: "Eliminar" });
    fireEvent.click(deleteBtn);

    expect(screen.getByText("Eliminar este texto?")).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", { name: "Eliminar" });
    const confirmBtn = deleteButtons[deleteButtons.length - 1];
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.deleteText).toHaveBeenCalledWith("t-1");
    });
  });
});
