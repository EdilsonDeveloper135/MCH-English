"use client";

import React from 'react';

interface ActionBarProps {
  onRetry?: () => void;
  onSkip?: () => void;
  onPrevious?: () => void;
  onEnd?: () => void;
  onSettings?: () => void;
  isFocused?: boolean;
  isPaused?: boolean;
}

/** Floating controls for the current exercise. Only the actions the screen actually
 * provides are rendered -- a button wired to nothing is worse than no button. */
export function ActionBar({
  onRetry,
  onSkip,
  onPrevious,
  onEnd,
  onSettings,
  isFocused = false,
  isPaused = false
}: ActionBarProps) {
  const buttons = [
    { icon: '↺', label: 'Reiniciar fragmento', onClick: onRetry },
    { icon: '←', label: 'Fragmento anterior', onClick: onPrevious },
    { icon: '→', label: 'Siguiente fragmento', onClick: onSkip },
    { icon: '⏹', label: 'Salir a la biblioteca', onClick: onEnd },
    { icon: '⚙', label: 'Ajustes de la sesion', onClick: onSettings },
  ].filter((btn): btn is { icon: string; label: string; onClick: () => void } => Boolean(btn.onClick));

  if (buttons.length === 0) return null;

  const focusClasses = isFocused
    ? "opacity-0 pointer-events-none hover:opacity-100 hover:pointer-events-auto transition-opacity duration-300"
    : "opacity-100 transition-opacity duration-300";

  return (
    <div
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 bg-[var(--bg-surface)]/80 backdrop-blur-sm rounded-xl px-3 py-2 flex gap-1 z-40 ${focusClasses}`}
      role="toolbar"
      aria-label="Controles de la sesion"
    >
      {isPaused && (
        <span className="self-center px-2 text-xs font-mono text-[var(--text-muted)]" aria-live="polite">
          en pausa
        </span>
      )}
      {buttons.map((btn) => (
        <button
          key={btn.label}
          type="button"
          aria-label={btn.label}
          title={btn.label}
          onClick={btn.onClick}
          // 44px minimum: the previous 32px squares were below the touch-target guidance.
          className="w-11 h-11 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
        >
          {btn.icon}
        </button>
      ))}
    </div>
  );
}
