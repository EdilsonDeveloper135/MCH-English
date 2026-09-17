import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ImporterModal } from "../ImporterModal";
import { api } from "@/services/api";

vi.mock("@/services/api", () => ({
  api: {
    createText: vi.fn(),
  },
}));

describe("ImporterModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(<ImporterModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders with 100% offline privacy notice and default paste tab", () => {
    render(<ImporterModal {...defaultProps} />);

    expect(screen.getByRole("dialog", { name: "Agregar Nuevo Texto" })).toBeInTheDocument();
    expect(screen.getByText(/100% Offline & Local/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pegar texto/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /importar pdf/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /importar epub/i })).toBeInTheDocument();
  });

  it("switches tabs between Paste, PDF and ePub", () => {
    render(<ImporterModal {...defaultProps} />);

    // PDF Tab
    fireEvent.click(screen.getByRole("button", { name: /importar pdf/i }));
    expect(screen.getByRole("region", { name: "Zona de carga de PDF" })).toBeInTheDocument();

    // ePub Tab
    fireEvent.click(screen.getByRole("button", { name: /importar epub/i }));
    expect(screen.getByRole("region", { name: "Zona de carga de ePub" })).toBeInTheDocument();

    // Back to Paste Tab
    fireEvent.click(screen.getByRole("button", { name: /pegar texto/i }));
    expect(screen.getByPlaceholderText(/Pega aquí el texto en inglés/i)).toBeInTheDocument();
  });

  it("submits text input and invokes onCreated", async () => {
    const mockCreated = {
      id: "text-1",
      title: "Sample Story",
      status: "ready",
      chunk_mode: "normal",
      word_count: 10,
      chunk_count: 1,
      current_chunk_index: 0,
      current_character_index: 0,
      progress_percent: 0,
      error_message: null,
      has_translation: false,
      alignment_status: "not_provided",
      created_at: "2024-01-01T00:00:00Z",
    };

    (api.createText as any).mockResolvedValue(mockCreated);

    render(<ImporterModal {...defaultProps} />);

    const titleInput = screen.getByPlaceholderText(/ej: Alice in Wonderland/i);
    const contentInput = screen.getByPlaceholderText(/Pega aquí el texto en inglés/i);

    fireEvent.change(titleInput, { target: { value: "Sample Story" } });
    fireEvent.change(contentInput, { target: { value: "This is a wonderful typing practice." } });

    fireEvent.click(screen.getByRole("button", { name: "Guardar texto" }));

    await waitFor(() => {
      expect(api.createText).toHaveBeenCalledWith(
        "Sample Story",
        "This is a wonderful typing practice.",
        "normal",
        ""
      );
      expect(defaultProps.onCreated).toHaveBeenCalledWith(mockCreated);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("calls onClose on Escape key press or Cancel button click", () => {
    render(<ImporterModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(2);
  });
});
