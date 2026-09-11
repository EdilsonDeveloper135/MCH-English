// Re-export CharStatus from the canonical source
export type CharStatus = "pending" | "correct" | "incorrect";

// Configurable options
export type SoundProfile = 'off' | 'mechanical' | 'soft' | 'minimal';
export type CursorStyle = 'line' | 'block' | 'underline';
export type CursorSpeed = 'adaptive' | 'fast' | 'normal';
export type StatsVisibility = 'minimal' | 'normal' | 'advanced';
export type ReadAheadLevel = 'off' | 'easy' | 'normal' | 'hard';
export type ThemeMode = 'oled' | 'nord' | 'catppuccin' | 'sepia';

// Keystroke log entry for replay
export interface Keystroke {
  key: string;
  timestamp: number;
  correct: boolean;
  charIndex: number;
}

// Per-key accumulated stats
export interface PerKeyStats {
  key: string;
  errors: number;
  correct: number;
  totalReactionMs: number;
  count: number;
}

// User preferences (persisted)
export interface UserPreferences {
  fontSize: number; // 14-24, default 18
  lineWidth: number; // in characters (ch), 60-100, default 80
  lineHeight: number; // 1.4-2.0, default 1.6
  cursorStyle: CursorStyle;
  cursorSpeed: CursorSpeed;
  soundProfile: SoundProfile;
  soundVolume: number; // 0.0-1.0
  statsVisibility: StatsVisibility;
  readAhead: ReadAheadLevel;
  reduceMotion: boolean;
  focusModeAuto: boolean;
  targetWPM: number | null;
  targetAccuracy: number | null;
  theme: ThemeMode;
}

// Post-session summary
export interface SessionResult {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  errors: number;
  duration: number; // seconds, excluding pauses
  characters: {
    correct: number;
    incorrect: number;
    extra: number;
    total: number;
  };
  bestStreak: number;
  problematicWords: Array<{ word: string; errors: number }>;
  problematicKeys: Array<{ key: string; accuracy: number; count: number }>;
  wpmOverTime: Array<{ time: number; wpm: number }>;
}

// Ghost data for competing against yourself
export interface GhostData {
  textId: string;
  chunkIndex: number;
  keystrokePositions: Array<{ time: number; charIndex: number; progress?: number }>;
  finalWpm: number;
  totalChars?: number;
}
