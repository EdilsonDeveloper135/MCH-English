import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeAll } from "vitest";
import { ConfirmModal } from "../ConfirmModal";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

describe("ConfirmModal", () => {
  it("renders title, description and calls callbacks on actions", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmModal
        open={true}
        title="¿Eliminar texto?"
        description="Esta acción no se puede deshacer"
        confirmLabel="Sí, eliminar"
        cancelLabel="No, cancelar"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText("¿Eliminar texto?")).toBeInTheDocument();
    expect(screen.getByText("Esta acción no se puede deshacer")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Sí, eliminar" });
    const cancelBtn = screen.getByRole("button", { name: "No, cancelar" });

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("handles native cancel event fired on Escape key", () => {
    const onCancel = vi.fn();
    const { container } = render(
      <ConfirmModal open={true} title="Test Dialog" onConfirm={vi.fn()} onCancel={onCancel} />
    );

    const dialog = container.querySelector("dialog");
    expect(dialog).toBeInTheDocument();

    // Fire cancel event
    fireEvent(dialog!, new Event("cancel", { cancelable: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
