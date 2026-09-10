import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SentenceInfoPanel } from "../SentenceInfoPanel";
import { api } from "@/services/api";
import type { SentenceDTO } from "@/types";

vi.mock("@/services/api", () => ({
  api: {
    updateGrammarNote: vi.fn(),
    addPhrase: vi.fn(),
    deletePhrase: vi.fn(),
  },
}));

const mockSentence: SentenceDTO = {
  id: "s-1",
  index: 0,
  content: "The quick brown fox jumps over the lazy dog.",
  translation: "El rápido zorro marrón salta sobre el perro perezoso.",
  grammar_note: "Subject + verb agreement",
  difficult_words: ["quick", "jumps"],
  phrases: [
    { id: "p-1", english_phrase: "jump over", spanish_phrase: "saltar sobre" },
  ],
};

describe("SentenceInfoPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toggles details panel visibility when clicking toggle button", () => {
    render(
      <SentenceInfoPanel
        textId="text-1"
        sentence={mockSentence}
        onGrammarNoteSaved={vi.fn()}
        onPhraseAdded={vi.fn()}
        onPhraseDeleted={vi.fn()}
      />
    );

    expect(screen.queryByText("Palabras dificiles")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver detalles" }));
    expect(screen.getByText("Palabras dificiles")).toBeInTheDocument();
    expect(screen.getByText("quick")).toBeInTheDocument();
    expect(screen.getByText("jumps")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ocultar detalles" }));
    expect(screen.queryByText("Palabras dificiles")).not.toBeInTheDocument();
  });

  it("saves edited grammar note and calls onGrammarNoteSaved", async () => {
    const onGrammarNoteSaved = vi.fn();
    (api.updateGrammarNote as any).mockResolvedValue({ grammar_note: "Updated note" });

    render(
      <SentenceInfoPanel
        textId="text-1"
        sentence={mockSentence}
        onGrammarNoteSaved={onGrammarNoteSaved}
        onPhraseAdded={vi.fn()}
        onPhraseDeleted={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver detalles" }));
    expect(screen.getByText("Subject + verb agreement")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const input = screen.getByPlaceholderText(/ej: require \+ noun/i);
    fireEvent.change(input, { target: { value: "Updated note" } });

    fireEvent.click(screen.getByRole("button", { name: "Guardar nota" }));

    await waitFor(() => {
      expect(api.updateGrammarNote).toHaveBeenCalledWith("text-1", "s-1", "Updated note");
      expect(onGrammarNoteSaved).toHaveBeenCalledWith("s-1", "Updated note");
    });
  });

  it("has accessible button to delete phrase and calls onPhraseDeleted", async () => {
    const onPhraseDeleted = vi.fn();
    (api.deletePhrase as any).mockResolvedValue(undefined);

    render(
      <SentenceInfoPanel
        textId="text-1"
        sentence={mockSentence}
        onGrammarNoteSaved={vi.fn()}
        onPhraseAdded={vi.fn()}
        onPhraseDeleted={onPhraseDeleted}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver detalles" }));

    const deleteBtn = screen.getByLabelText("Eliminar frase");
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(api.deletePhrase).toHaveBeenCalledWith("text-1", "s-1", "p-1");
      expect(onPhraseDeleted).toHaveBeenCalledWith("s-1", "p-1");
    });
  });

  it("adds a new phrase with accessible save button and calls onPhraseAdded", async () => {
    const onPhraseAdded = vi.fn();
    const newPhrase = { id: "p-2", english_phrase: "lazy dog", spanish_phrase: "perro perezoso" };
    (api.addPhrase as any).mockResolvedValue(newPhrase);

    render(
      <SentenceInfoPanel
        textId="text-1"
        sentence={mockSentence}
        onGrammarNoteSaved={vi.fn()}
        onPhraseAdded={onPhraseAdded}
        onPhraseDeleted={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver detalles" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Agregar frase" }));

    const enInput = screen.getByPlaceholderText("ingles");
    const esInput = screen.getByPlaceholderText("espanol");

    fireEvent.change(enInput, { target: { value: "lazy dog" } });
    fireEvent.change(esInput, { target: { value: "perro perezoso" } });

    const saveBtn = screen.getByLabelText("Guardar frase");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.addPhrase).toHaveBeenCalledWith("text-1", "s-1", "lazy dog", "perro perezoso");
      expect(onPhraseAdded).toHaveBeenCalledWith("s-1", newPhrase);
    });
  });
});
