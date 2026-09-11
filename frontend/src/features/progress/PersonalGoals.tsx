"use client";

import React, { useState } from "react";
import { useTypingStore } from "@/stores/typingStore";

interface PersonalGoalsProps {
  currentWpm: number;
  currentAccuracy: number;
}

/** Speed and accuracy goals, compared against the user's real statistics from the API.
 * Nothing here is simulated: with no goal set, it says so instead of inventing one. */
export function PersonalGoals({ currentWpm, currentAccuracy }: PersonalGoalsProps) {
  const preferences = useTypingStore((s) => s.preferences);
  const setPreference = useTypingStore((s) => s.setPreference);

  const [editMode, setEditMode] = useState(false);
  const [localWpm, setLocalWpm] = useState(preferences.targetWPM ?? 80);
  const [localAccuracy, setLocalAccuracy] = useState(preferences.targetAccuracy ?? 98);

  const wpmProgress = preferences.targetWPM ? Math.min(100, (currentWpm / preferences.targetWPM) * 100) : 0;
  const accuracyProgress = preferences.targetAccuracy
    ? Math.min(100, (currentAccuracy / preferences.targetAccuracy) * 100)
    : 0;

  const handleSave = () => {
    setPreference("targetWPM", localWpm);
    setPreference("targetAccuracy", localAccuracy);
    setEditMode(false);
  };

  const recommendation = () => {
    if (!preferences.targetWPM || !preferences.targetAccuracy) {
      return "Define tus objetivos para ver recomendaciones basadas en tus propias sesiones.";
    }
    if (currentAccuracy < preferences.targetAccuracy) {
      return "Prioriza la precisión: practica tus palabras débiles antes de subir la velocidad.";
    }
    if (currentWpm < preferences.targetWPM) {
      return "Vas fino de precisión. Practica fragmentos más largos para ganar velocidad sostenida.";
    }
    return "Estás cumpliendo tus objetivos. Es buen momento para subir el listón.";
  };

  return (
    <div className="bg-neutral-950/80 border border-neutral-900 rounded-2xl p-6 flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Objetivos personales</h2>
        <button
          type="button"
          onClick={() => setEditMode(!editMode)}
          className="text-sm text-neutral-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none rounded px-2 py-1"
        >
          {editMode ? "Cancelar" : "Editar objetivos"}
        </button>
      </div>

      {editMode ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="goal-wpm" className="text-sm text-neutral-400">
              PPM objetivo
            </label>
            <input
              id="goal-wpm"
              type="number"
              min={10}
              max={300}
              value={localWpm}
              onChange={(e) => setLocalWpm(Number(e.target.value))}
              className="bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-white focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="goal-accuracy" className="text-sm text-neutral-400">
              Precisión objetivo (%)
            </label>
            <input
              id="goal-accuracy"
              type="number"
              min={50}
              max={100}
              value={localAccuracy}
              onChange={(e) => setLocalAccuracy(Number(e.target.value))}
              className="bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-white focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="bg-[var(--accent)] text-black font-semibold py-2 rounded-lg hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            Guardar objetivos
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Objetivo de velocidad: {preferences.targetWPM ?? "—"} PPM</span>
              <span className="text-white font-medium tabular-nums">{Math.round(currentWpm)} PPM</span>
            </div>
            <div className="h-2 bg-neutral-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-700"
                style={{ width: `${wpmProgress}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Objetivo de precisión: {preferences.targetAccuracy ?? "—"}%</span>
              <span className="text-white font-medium tabular-nums">{currentAccuracy.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-neutral-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-700"
                style={{ width: `${accuracyProgress}%` }}
              />
            </div>
          </div>

          <p className="text-sm text-neutral-400 leading-relaxed bg-neutral-900/40 p-4 rounded-xl border border-neutral-900">
            <span className="text-[var(--accent)] font-medium">Sugerencia:</span> {recommendation()}
          </p>
        </div>
      )}
    </div>
  );
}
