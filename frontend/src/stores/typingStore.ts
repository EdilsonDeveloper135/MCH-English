import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GhostData, PerKeyStats, UserPreferences } from "@/types/typing";

/** Ghost runs are a nicety, not history: keeping one entry per chunk ever practiced
 * grew `localStorage` without bound until writes started throwing QuotaExceededError. */
const MAX_GHOST_ENTRIES = 20;
/** A full run can be thousands of keystrokes; the racer only needs a coarse curve. */
const MAX_GHOST_POINTS = 200;

interface TypingStoreState {
  preferences: UserPreferences;
  isFocusMode: boolean;
  perKeyStats: Record<string, PerKeyStats>;
  ghostData: Record<string, GhostData>;
}

interface TypingStoreActions {
  setPreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  mergePerKeyStats: (batch: Record<string, PerKeyStats>) => void;
  setFocusMode: (isFocusMode: boolean) => void;
  saveGhostData: (data: GhostData) => void;
}

type TypingStore = TypingStoreState & TypingStoreActions;

const getInitialReduceMotion = (): boolean => {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
};

export const defaultPreferences: UserPreferences = {
  fontSize: 18,
  lineWidth: 80,
  lineHeight: 1.6,
  cursorStyle: "line",
  cursorSpeed: "adaptive",
  soundProfile: "off",
  soundVolume: 0.5,
  statsVisibility: "normal",
  readAhead: "normal",
  reduceMotion: getInitialReduceMotion(),
  focusModeAuto: false,
  targetWPM: null,
  targetAccuracy: null,
  theme: "oled",
};

function downsample<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = Math.ceil(points.length / max);
  const sampled = points.filter((_, index) => index % step === 0);
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

export const useTypingStore = create<TypingStore>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      isFocusMode: false,
      perKeyStats: {},
      ghostData: {},

      setPreference: (key, value) =>
        set((state) => ({ preferences: { ...state.preferences, [key]: value } })),

      /** Applied once per finished session with the whole batch. Writing per keystroke
       * (as this used to) meant a JSON serialization + localStorage write on the main
       * thread for every single character typed. */
      mergePerKeyStats: (batch) =>
        set((state) => {
          const merged: Record<string, PerKeyStats> = { ...state.perKeyStats };
          for (const [key, delta] of Object.entries(batch)) {
            const current = merged[key] ?? { key, errors: 0, correct: 0, totalReactionMs: 0, count: 0 };
            merged[key] = {
              key,
              errors: current.errors + delta.errors,
              correct: current.correct + delta.correct,
              totalReactionMs: current.totalReactionMs + delta.totalReactionMs,
              count: current.count + delta.count,
            };
          }
          return { perKeyStats: merged };
        }),

      setFocusMode: (isFocusMode) => set({ isFocusMode }),

      saveGhostData: (data) =>
        set((state) => {
          const entries = Object.entries(state.ghostData);
          const trimmed = entries.slice(Math.max(0, entries.length - (MAX_GHOST_ENTRIES - 1)));
          return {
            ghostData: {
              ...Object.fromEntries(trimmed),
              [`${data.textId}-${data.chunkIndex}`]: {
                ...data,
                keystrokePositions: downsample(data.keystrokePositions, MAX_GHOST_POINTS),
              },
            },
          };
        }),
    }),
    {
      name: "mch-english-typing-storage",
      partialize: (state) => ({
        preferences: state.preferences,
        perKeyStats: state.perKeyStats,
        ghostData: state.ghostData,
      }),
      // A store saved by an older build may lack newly added preferences; merging over
      // the defaults keeps every field defined instead of leaving holes.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<TypingStoreState>;
        return {
          ...current,
          ...saved,
          preferences: { ...defaultPreferences, ...(saved.preferences ?? {}) },
        };
      },
    }
  )
);
