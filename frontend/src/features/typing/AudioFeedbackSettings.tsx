"use client";

import { useEffect, useState } from "react";
import { audioCuePlayer } from "./audioCues";

export function AudioFeedbackSettings() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(audioCuePlayer.isEnabled());
  }, []);

  function toggle() {
    const next = !enabled;
    audioCuePlayer.setEnabled(next);
    setEnabled(next);
    if (next) {
      audioCuePlayer.playClick();
    }
  }

  return (
    <button
      onClick={toggle}
      title={enabled ? "Desactivar sonido de teclas" : "Activar sonido de teclas"}
      aria-label={enabled ? "Desactivar sonido de teclas" : "Activar sonido de teclas"}
      className="text-xs px-2 py-1 rounded text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
    >
      <span>{enabled ? "🔊 Sonido ON" : "🔇 Sonido OFF"}</span>
    </button>
  );
}
