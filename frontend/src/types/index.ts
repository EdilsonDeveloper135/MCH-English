export type ChunkMode = "short" | "normal" | "long" | "continuous";
export type TextStatus = "pending" | "processing" | "ready" | "failed";
export type AlignmentStatus = "not_provided" | "needs_review" | "confirmed";

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
  has_translation: boolean;
  alignment_status: AlignmentStatus;
  created_at: string;
}

export interface PhraseDTO {
  id: string;
  english_phrase: string;
  spanish_phrase: string;
}

export interface SentenceDTO {
  id: string;
  index: number;
  content: string;
  translation: string | null;
  grammar_note: string | null;
  phrases: PhraseDTO[];
  difficult_words: string[];
}

export type TranslationMode = "learning" | "immersion" | "assisted";

export interface UserSettingsDTO {
  translation_mode: TranslationMode;
}

export interface AlignmentSentenceDTO {
  index: number;
  content: string;
}

export interface AlignmentLinkDTO {
  english_index: number;
  spanish_index: number;
}

export interface AlignmentDTO {
  alignment_status: AlignmentStatus;
  english_sentences: AlignmentSentenceDTO[];
  spanish_sentences: AlignmentSentenceDTO[];
  links: AlignmentLinkDTO[];
}

export interface DictionaryLookupDTO {
  word: string;
  translations: string;
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
  text_id: string | null;
  chunk_id: string | null;
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
  current_wpm: number;
  total_errors: number;
  texts_count: number;
  texts_ready: number;
  average_recall_accuracy: number;
  average_dictation_accuracy: number;
  words_encountered: number;
  words_learned: number;
  weak_words_count: number;
  sentences_completed: number;
}

export interface HistoryPointDTO {
  date: string;
  average_wpm: number;
  average_accuracy: number;
  practice_seconds: number;
}

export interface VocabularyBucketDTO {
  range: string;
  count: number;
}

export interface ErrorInput {
  expected_char: string;
  typed_char: string;
  position: number;
  word: string;
  sentence_id: string | null;
}

export interface VocabularyItemDTO {
  word: string;
  translation: string | null;
  encounters: number;
  typing_errors: number;
  mastery_score: number;
  last_seen: string;
}

export interface WeakWordSentenceDTO {
  id: string;
  content: string;
}

export interface WeakWordsSessionDTO {
  session_id: string;
  words: string[];
  sentences: WeakWordSentenceDTO[];
}

export type RecallMode = "missing_words" | "spanish_to_english";

export interface BlankDTO {
  start: number;
  end: number;
}

export interface RecallRoundDTO {
  sentence_id: string;
  content: string | null;
  blanks: BlankDTO[] | null;
  spanish_prompt: string | null;
  english_content: string | null;
}

export interface RecallSessionDTO {
  session_id: string;
  mode: RecallMode;
  rounds: RecallRoundDTO[];
}

export interface RecallAttemptDTO {
  id: string;
  expected: string;
  typed: string;
  accuracy: number;
  correct_words: number;
  incorrect_words: number;
}

export interface DictationRoundDTO {
  sentence_id: string;
  content: string;
}

export interface DictationSessionDTO {
  session_id: string;
  rounds: DictationRoundDTO[];
}

export interface DictationAttemptDTO {
  id: string;
  expected: string;
  typed: string;
  accuracy: number;
  correct_words: number;
  incorrect_words: number;
}
