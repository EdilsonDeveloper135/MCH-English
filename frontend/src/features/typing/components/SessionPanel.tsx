"use client";

import React, { useEffect, useState } from 'react';
import { useTypingStore } from '@/stores/typingStore';
import type { CursorStyle, ReadAheadLevel, SoundProfile, StatsVisibility } from '@/types/typing';

interface SessionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SOUND_PROFILES: { value: SoundProfile; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'mechanical', label: 'Mecánico' },
  { value: 'soft', label: 'Suave' },
  { value: 'minimal', label: 'Mínimo' },
];

const STATS_LEVELS: { value: StatsVisibility; label: string }[] = [
  { value: 'minimal', label: 'Mínimas' },
  { value: 'normal', label: 'Normales' },
  { value: 'advanced', label: 'Avanzadas' },
];

const READ_AHEAD: { value: ReadAheadLevel; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'easy', label: 'Suave' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Fuerte' },
];

const CURSORS: { value: CursorStyle; label: string }[] = [
  { value: 'line', label: 'Línea' },
  { value: 'block', label: 'Bloque' },
  { value: 'underline', label: 'Subrayado' },
];

/** Quick access, during a session, to the preferences that change how the exercise
 * looks and sounds. Every control writes a key that really exists in the store --
 * several of them used to write invented ones ('sound', 'targetWpm', 'difficulty')
 * that nothing ever read. */
export function SessionPanel({ isOpen, onClose }: SessionPanelProps) {
  const [isRendered, setIsRendered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const preferences = useTypingStore((state) => state.preferences);
  const setPreference = useTypingStore((state) => state.setPreference);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      const frame = requestAnimationFrame(() => setIsAnimating(true));
      return () => cancelAnimationFrame(frame);
    }
    setIsAnimating(false);
    const timer = setTimeout(() => setIsRendered(false), 300);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isRendered) return null;

  const pill = (isActive: boolean) =>
    `px-3 py-1.5 rounded-full text-sm transition-colors border focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
      isActive
        ? 'bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/40'
        : 'bg-neutral-900/60 text-neutral-400 border-neutral-700 hover:border-neutral-500'
    }`;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-[2px] z-30 transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ajustes de la sesión"
        className={`fixed top-0 right-0 h-full w-80 bg-[var(--bg-surface)]/95 backdrop-blur-md border-l border-neutral-800 shadow-2xl z-40 overflow-y-auto transition-transform duration-300 ease-in-out ${isAnimating ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6 mt-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Ajustes de la sesión</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ajustes"
              className="text-neutral-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none rounded"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-7">
            <section>
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Sonido</h3>
              <div className="grid grid-cols-2 gap-2">
                {SOUND_PROFILES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPreference('soundProfile', option.value)}
                    className={pill(preferences.soundProfile === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Métricas en vivo</h3>
              <div className="flex flex-wrap gap-2">
                {STATS_LEVELS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPreference('statsVisibility', option.value)}
                    className={pill(preferences.statsVisibility === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Lectura anticipada</h3>
              <div className="flex flex-wrap gap-2">
                {READ_AHEAD.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPreference('readAhead', option.value)}
                    className={pill(preferences.readAhead === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Cursor</h3>
              <div className="flex flex-wrap gap-2">
                {CURSORS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPreference('cursorStyle', option.value)}
                    className={pill(preferences.cursorStyle === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="session-font-size" className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                  Tamaño
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="session-font-size"
                    type="range"
                    min="14"
                    max="24"
                    value={preferences.fontSize}
                    onChange={(e) => setPreference('fontSize', Number(e.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                  <span className="text-xs text-neutral-400 w-8 tabular-nums">{preferences.fontSize}px</span>
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                  Menos animación
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences.reduceMotion}
                  aria-label="Reducir animaciones"
                  onClick={() => setPreference('reduceMotion', !preferences.reduceMotion)}
                  className={`w-11 h-6 rounded-full transition-colors relative focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${preferences.reduceMotion ? 'bg-[var(--accent)]' : 'bg-neutral-700'}`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${preferences.reduceMotion ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
