export type ChunkMode = "short" | "normal" | "long" | "continuous";
export type TextStatus = "pending" | "processing" | "ready" | "failed";

export interface TextDTO {
  id: string;
  title: string;
  status: TextStatus;
  chunk_mode: ChunkMode;
  word_count: number;
  chunk_count: number;
  current_chunk_index: number;
  current_character_index: number;
  progress_percent: number;
  error_message: string | null;
  created_at: string;
}

export interface SentenceDTO {
  id: string;
  index: number;
  content: string;
}

export interface ChunkDTO {
  id: string;
  index: number;
  word_count: number;
  total_chunks: number;
  sentences: SentenceDTO[];
}

export interface SessionDTO {
  id: string;
  text_id: string;
  chunk_id: string;
  started_at: string;
  finished_at: string | null;
  correct_characters: number;
  incorrect_characters: number;
  total_characters: number;
  wpm: number;
  accuracy: number;
}

export interface OverviewStatsDTO {
  total_sessions: number;
  total_practice_seconds: number;
  average_wpm: number;
  average_accuracy: number;
  best_wpm: number;
  texts_count: number;
  texts_ready: number;
}

export interface ErrorInput {
  expected_char: string;
  typed_char: string;
  position: number;
  word: string;
  sentence_id: string | null;
}
