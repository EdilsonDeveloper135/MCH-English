"use client";

import React, { useEffect } from "react";

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: "⌘K / Ctrl+K", desc: "Abrir paleta de comandos / Buscar textos" },
  { key: "⌘N / Ctrl+N", desc: "Crear nuevo texto / Importar" },
  { key: "⌘/ / Ctrl+/", desc: "Alternar este panel de atajos" },
  { key: "Esc", desc: "Cerrar modales o salir de Modo Zen" },
  { key: "Enter", desc: "Avanzar al siguiente fragmento tras completar" },
  { key: "R", desc: "Reintentar fragmento actual en pantalla de resultados" },
  { key: "Ctrl+⌫ / Alt+⌫", desc: "Borrar la palabra anterior en modo tipeo" },
];

export function ShortcutsHelpModal({ isOpen, onClose }: ShortcutsHelpModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-help-title"
        className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h2 id="shortcuts-help-title" className="text-lg font-bold text-white flex items-center gap-2">
            <span>⌨️</span> Atajos de Teclado
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de atajos"
            className="text-neutral-400 hover:text-white p-1 rounded-lg text-sm"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2.5">
          {SHORTCUTS.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-neutral-950/60 border border-neutral-800/60"
            >
              <span className="text-neutral-300">{s.desc}</span>
              <kbd className="font-mono bg-neutral-800 border border-neutral-700 text-neutral-200 px-2 py-0.5 rounded text-[11px] shadow-sm">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center text-xs text-neutral-500">
          Presiona <kbd className="font-mono bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300">Esc</kbd> para cerrar
        </div>
      </div>
    </div>
  );
}
