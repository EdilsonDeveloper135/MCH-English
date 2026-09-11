"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { useTypingStore } from "@/stores/typingStore";
import { api } from "@/services/api";
import type {
  CursorSpeed,
  CursorStyle,
  ReadAheadLevel,
  SoundProfile,
  StatsVisibility,
  ThemeMode,
} from "@/types/typing";

const SELECT_CLASS =
  "bg-background border border-surface-border rounded p-1.5 text-sm text-text-primary focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none";
const SECTION_CLASS =
  "bg-surface border border-surface-border rounded-xl p-6 flex flex-col gap-5";

export default function SettingsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const preferences = useTypingStore((s) => s.preferences);
  const setPreference = useTypingStore((s) => s.setPreference);

  const [mounted, setMounted] = useState(false);
  const [dailyGoal, setDailyGoal] = useState<number | null>(null);
  const [goalDraft, setGoalDraft] = useState("");
  const [goalStatus, setGoalStatus] = useState<string | null>(null);

  const [timezone, setTimezone] = useState<string>("UTC");
  const [tzStatus, setTzStatus] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Same guard as every other page: /settings was reachable without a session.
  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  useEffect(() => {
    if (!hasHydrated || !token) return;
    api
      .getSettings()
      .then((s) => {
        setDailyGoal(s.daily_goal_minutes);
        setGoalDraft(String(s.daily_goal_minutes));
        setTimezone(s.timezone || "UTC");
      })
      .catch(() => setGoalStatus("No se pudieron cargar los ajustes de la cuenta."));
  }, [hasHydrated, token]);

  async function saveDailyGoal() {
    const minutes = Number(goalDraft);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 480) {
      setGoalStatus("Elige un objetivo entre 1 y 480 minutos.");
      return;
    }
    try {
      const updated = await api.updateSettings({ daily_goal_minutes: Math.round(minutes) });
      setDailyGoal(updated.daily_goal_minutes);
      setGoalStatus("Objetivo diario actualizado.");
    } catch {
      setGoalStatus("No se pudo guardar el objetivo diario.");
    }
  }

  async function saveTimezone(newTz: string) {
    try {
      const updated = await api.updateSettings({ timezone: newTz });
      setTimezone(updated.timezone);
      setTzStatus("Zona horaria actualizada.");
    } catch {
      setTzStatus("No se pudo guardar la zona horaria.");
    }
  }

  function detectTimezone() {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) {
        setTimezone(detected);
        saveTimezone(detected);
      }
    } catch {
      setTzStatus("No se pudo detectar la zona horaria del navegador.");
    }
  }

  if (!mounted || !hasHydrated) {
    return <div className="p-8 text-text-muted">Cargando ajustes...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-text-primary">Ajustes</h1>
        <p className="text-text-muted">Personaliza tu experiencia de escritura.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="flex flex-col gap-8">
          <section className={SECTION_CLASS}>
            <h2 className="text-lg font-semibold text-text-primary border-b border-surface-border pb-2">Apariencia</h2>

            <div className="flex justify-between items-center">
              <label htmlFor="pref-theme" className="text-sm text-text-muted font-medium">
                Tema
              </label>
              <select
                id="pref-theme"
                value={preferences.theme}
                onChange={(e) => setPreference("theme", e.target.value as ThemeMode)}
                className={SELECT_CLASS}
              >
                <option value="oled">OLED</option>
                <option value="nord">Nord</option>
                <option value="catppuccin">Catppuccin</option>
                <option value="sepia">Sepia</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <label htmlFor="pref-font-size" className="text-sm text-text-muted font-medium">
                  Tamaño del texto
                </label>
                <span className="text-sm text-text-primary font-mono tabular-nums">{preferences.fontSize}px</span>
              </div>
              <input
                id="pref-font-size"
                type="range"
                min="14"
                max="24"
                value={preferences.fontSize}
                onChange={(e) => setPreference("fontSize", Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <label htmlFor="pref-line-width" className="text-sm text-text-muted font-medium">
                  Ancho de línea
                </label>
                <span className="text-sm text-text-primary font-mono tabular-nums">{preferences.lineWidth} ch</span>
              </div>
              <input
                id="pref-line-width"
                type="range"
                min="40"
                max="100"
                value={preferences.lineWidth}
                onChange={(e) => setPreference("lineWidth", Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <label htmlFor="pref-line-height" className="text-sm text-text-muted font-medium">
                  Altura de línea
                </label>
                <span className="text-sm text-text-primary font-mono tabular-nums">
                  {preferences.lineHeight.toFixed(1)}
                </span>
              </div>
              <input
                id="pref-line-height"
                type="range"
                min="1.4"
                max="2.0"
                step="0.1"
                value={preferences.lineHeight}
                onChange={(e) => setPreference("lineHeight", Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>
          </section>

          <section className={SECTION_CLASS}>
            <h2 className="text-lg font-semibold text-text-primary border-b border-surface-border pb-2">Cursor</h2>

            <div className="flex justify-between items-center">
              <label htmlFor="pref-cursor-style" className="text-sm text-text-muted font-medium">
                Estilo
              </label>
              <select
                id="pref-cursor-style"
                value={preferences.cursorStyle}
                onChange={(e) => setPreference("cursorStyle", e.target.value as CursorStyle)}
                className={SELECT_CLASS}
              >
                <option value="line">Línea</option>
                <option value="block">Bloque</option>
                <option value="underline">Subrayado</option>
              </select>
            </div>

            <div className="flex justify-between items-center">
              <label htmlFor="pref-cursor-speed" className="text-sm text-text-muted font-medium">
                Velocidad de animación
              </label>
              <select
                id="pref-cursor-speed"
                value={preferences.cursorSpeed}
                onChange={(e) => setPreference("cursorSpeed", e.target.value as CursorSpeed)}
                className={SELECT_CLASS}
              >
                <option value="adaptive">Adaptativa</option>
                <option value="fast">Rápida</option>
                <option value="normal">Normal</option>
              </select>
            </div>
          </section>

          <section className={SECTION_CLASS}>
            <h2 className="text-lg font-semibold text-text-primary border-b border-surface-border pb-2">
              Sonido y experiencia
            </h2>

            <div className="flex justify-between items-center">
              <label htmlFor="pref-sound" className="text-sm text-text-muted font-medium">
                Perfil de sonido
              </label>
              <select
                id="pref-sound"
                value={preferences.soundProfile}
                onChange={(e) => setPreference("soundProfile", e.target.value as SoundProfile)}
                className={SELECT_CLASS}
              >
                <option value="off">Off</option>
                <option value="mechanical">Mecánico</option>
                <option value="soft">Suave</option>
                <option value="minimal">Mínimo</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <label htmlFor="pref-volume" className="text-sm text-text-muted font-medium">
                  Volumen
                </label>
                <span className="text-sm text-text-primary font-mono tabular-nums">
                  {Math.round(preferences.soundVolume * 100)}%
                </span>
              </div>
              <input
                id="pref-volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={preferences.soundVolume}
                onChange={(e) => setPreference("soundVolume", Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <label htmlFor="pref-reduce-motion" className="text-sm text-text-muted font-medium">
                Reducir animaciones
              </label>
              <input
                id="pref-reduce-motion"
                type="checkbox"
                checked={preferences.reduceMotion}
                onChange={(e) => setPreference("reduceMotion", e.target.checked)}
                className="accent-accent w-5 h-5 cursor-pointer"
              />
            </div>
            <div className="flex justify-between items-center">
              <label htmlFor="pref-focus-auto" className="text-sm text-text-muted font-medium">
                Modo foco automático
              </label>
              <input
                id="pref-focus-auto"
                type="checkbox"
                checked={preferences.focusModeAuto}
                onChange={(e) => setPreference("focusModeAuto", e.target.checked)}
                className="accent-accent w-5 h-5 cursor-pointer"
              />
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-8 lg:sticky lg:top-6">
          <section className={`${SECTION_CLASS} shadow-xl`}>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Vista previa</h2>
            <div
              className="font-mono text-text-primary transition-all duration-300 break-words whitespace-pre-wrap"
              style={{
                fontSize: `${preferences.fontSize}px`,
                maxWidth: `${preferences.lineWidth}ch`,
                lineHeight: preferences.lineHeight,
              }}
            >
              <span className="text-char-correct">The quick brown fox </span>
              <span className="text-char-incorrect">jumps </span>
              <span className="text-char-pending">over the lazy dog.</span>
            </div>
          </section>

          <section className={SECTION_CLASS}>
            <h2 className="text-lg font-semibold text-text-primary border-b border-surface-border pb-2">Escritura</h2>

            <div className="flex justify-between items-center">
              <label htmlFor="pref-stats" className="text-sm text-text-muted font-medium">
                Métricas en vivo
              </label>
              <select
                id="pref-stats"
                value={preferences.statsVisibility}
                onChange={(e) => setPreference("statsVisibility", e.target.value as StatsVisibility)}
                className={SELECT_CLASS}
              >
                <option value="minimal">Mínimas</option>
                <option value="normal">Normales</option>
                <option value="advanced">Avanzadas</option>
              </select>
            </div>

            <div className="flex justify-between items-center">
              <label htmlFor="pref-read-ahead" className="text-sm text-text-muted font-medium">
                Lectura anticipada
              </label>
              <select
                id="pref-read-ahead"
                value={preferences.readAhead}
                onChange={(e) => setPreference("readAhead", e.target.value as ReadAheadLevel)}
                className={SELECT_CLASS}
              >
                <option value="off">Off</option>
                <option value="easy">Suave</option>
                <option value="normal">Normal</option>
                <option value="hard">Fuerte</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="pref-target-wpm" className="text-sm text-text-muted font-medium">
                PPM objetivo
              </label>
              <input
                id="pref-target-wpm"
                type="number"
                min={10}
                max={300}
                value={preferences.targetWPM ?? ""}
                placeholder="ej. 80"
                onChange={(e) => setPreference("targetWPM", e.target.value ? Number(e.target.value) : null)}
                className="bg-background border border-surface-border rounded p-2.5 text-sm text-text-primary font-mono focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pref-target-accuracy" className="text-sm text-text-muted font-medium">
                Precisión objetivo (%)
              </label>
              <input
                id="pref-target-accuracy"
                type="number"
                min={50}
                max={100}
                value={preferences.targetAccuracy ?? ""}
                placeholder="ej. 98"
                onChange={(e) => setPreference("targetAccuracy", e.target.value ? Number(e.target.value) : null)}
                className="bg-background border border-surface-border rounded p-2.5 text-sm text-text-primary font-mono focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
              />
            </div>
          </section>

          <section className={SECTION_CLASS}>
            <h2 className="text-lg font-semibold text-text-primary border-b border-surface-border pb-2">
              Objetivo diario
            </h2>
            <p className="text-sm text-text-muted">
              Minutos de práctica al día. Alimenta la racha y el progreso de Gamificación.
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="pref-daily-goal" className="sr-only">
                Minutos por día
              </label>
              <input
                id="pref-daily-goal"
                type="number"
                min={1}
                max={480}
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                className="w-24 bg-background border border-surface-border rounded p-2 text-sm text-text-primary font-mono focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
              />
              <button
                type="button"
                onClick={saveDailyGoal}
                disabled={dailyGoal === null}
                className="bg-accent text-black text-sm font-semibold px-4 py-2 rounded hover:opacity-90 disabled:opacity-50 transition-opacity focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
              >
                Guardar
              </button>
            </div>
            {goalStatus && <p className="text-xs text-text-muted">{goalStatus}</p>}
          </section>

          <section className={SECTION_CLASS}>
            <h2 className="text-lg font-semibold text-text-primary border-b border-surface-border pb-2">
              Zona horaria
            </h2>
            <p className="text-sm text-text-muted">
              Define el corte de día para el cómputo de tus rachas y objetivos diarios.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <label htmlFor="pref-timezone" className="sr-only">
                Zona horaria
              </label>
              <select
                id="pref-timezone"
                value={timezone}
                onChange={(e) => saveTimezone(e.target.value)}
                className={`${SELECT_CLASS} max-w-xs`}
              >
                <option value="UTC">UTC (Tiempo Universal)</option>
                <option value="America/Lima">America/Lima (UTC-5)</option>
                <option value="America/Bogota">America/Bogota (UTC-5)</option>
                <option value="America/Santiago">America/Santiago (UTC-3 / UTC-4)</option>
                <option value="America/Buenos_Aires">America/Buenos_Aires (UTC-3)</option>
                <option value="America/Mexico_City">America/Mexico_City (UTC-6)</option>
                <option value="America/New_York">America/New_York (UTC-4 / UTC-5)</option>
                <option value="America/Chicago">America/Chicago (UTC-5 / UTC-6)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (UTC-7 / UTC-8)</option>
                <option value="Europe/Madrid">Europe/Madrid (UTC+1 / UTC+2)</option>
                <option value="Europe/London">Europe/London (UTC+0 / UTC+1)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                {!["UTC", "America/Lima", "America/Bogota", "America/Santiago", "America/Buenos_Aires", "America/Mexico_City", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/Madrid", "Europe/London", "Asia/Tokyo"].includes(timezone) && (
                  <option value={timezone}>{timezone}</option>
                )}
              </select>
              <button
                type="button"
                onClick={detectTimezone}
                className="bg-neutral-800 text-text-primary text-xs font-medium px-3 py-2 rounded hover:bg-neutral-700 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
              >
                Detectar mi zona horaria
              </button>
            </div>
            {tzStatus && <p className="text-xs text-text-muted">{tzStatus}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
