"use client";

import { useEffect, useRef } from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Accessible confirmation dialog built on the native <dialog> element -- it gives
 * focus handling and Escape-to-close for free, unlike window.confirm() (which
 * blocks the main thread and can't be styled at all). */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // React 18 doesn't wire up onCancel/onClose as real event listeners for
    // <dialog> (that support only landed in React 19), so the native `cancel`
    // event -- fired on Escape -- has to be bound by hand here instead.
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCancel();
    };
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onCancel]);

  return (
    <dialog
      ref={dialogRef}
      className="bg-gray-900 border border-gray-800 rounded p-6 text-gray-200 max-w-sm w-[calc(100%-2rem)] backdrop:bg-black/60"
    >
      <h2 className="text-white text-base font-semibold mb-2">{title}</h2>
      {description && <p className="text-sm text-gray-400 mb-6">{description}</p>}
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="text-sm text-gray-400 hover:text-white">
          {cancelLabel}
        </button>
        <button onClick={onConfirm} className="bg-red-600 hover:bg-red-500 text-white text-sm rounded px-3 py-1.5">
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
