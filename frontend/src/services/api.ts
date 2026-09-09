import { useAuthStore } from "@/stores/authStore";
import type {
  AlignmentDTO,
  AlignmentLinkDTO,
  BlankDTO,
  ChunkDTO,
  ChunkMode,
  DictationAttemptDTO,
  DictationSessionDTO,
  DictionaryLookupDTO,
  ErrorInput,
  HistoryPointDTO,
  OverviewStatsDTO,
  RecallAttemptDTO,
  RecallMode,
  RecallSessionDTO,
  SessionDTO,
  TextDTO,
  VocabularyBucketDTO,
  VocabularyItemDTO,
  WeakWordsSessionDTO,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch {
      // response had no JSON body; keep statusText
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

interface FinishSessionPayload {
  correct_characters: number;
  incorrect_characters: number;
  total_characters: number;
  duration_seconds: number;
  errors: ErrorInput[];
}

export const api = {
  register: (email: string, password: string) =>
    request<{ access_token: string; token_type: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ access_token: string; token_type: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ id: string; email: string }>("/auth/me"),

  listTexts: () => request<TextDTO[]>("/texts"),

  createText: (title: string, raw_content: string, chunk_mode: ChunkMode, translation_content?: string) =>
    request<TextDTO>("/texts", {
      method: "POST",
      body: JSON.stringify({ title, raw_content, chunk_mode, translation_content: translation_content || null }),
    }),

  getText: (id: string) => request<TextDTO>(`/texts/${id}`),

  deleteText: (id: string) => request<void>(`/texts/${id}`, { method: "DELETE" }),

  getChunk: (textId: string, index: number) => request<ChunkDTO>(`/texts/${textId}/chunks/${index}`),

  updateProgress: (textId: string, current_chunk_index: number, current_character_index: number) =>
    request<TextDTO>(`/texts/${textId}/progress`, {
      method: "PATCH",
      body: JSON.stringify({ current_chunk_index, current_character_index }),
    }),

  createSession: (text_id: string, chunk_id: string) =>
    request<SessionDTO>("/sessions", {
      method: "POST",
      body: JSON.stringify({ text_id, chunk_id }),
    }),

  finishSession: (sessionId: string, stats: FinishSessionPayload) =>
    request<SessionDTO>(`/sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify(stats),
    }),

  getOverview: () => request<OverviewStatsDTO>("/statistics/overview"),

  getHistory: (days?: number) =>
    request<HistoryPointDTO[]>(`/statistics/history${days ? `?days=${days}` : ""}`),

  getVocabularyDistribution: () => request<VocabularyBucketDTO[]>("/statistics/vocabulary-distribution"),

  updateTranslation: (textId: string, translation_content: string) =>
    request<TextDTO>(`/texts/${textId}/translation`, {
      method: "PATCH",
      body: JSON.stringify({ translation_content }),
    }),

  getAlignment: (textId: string) => request<AlignmentDTO>(`/texts/${textId}/alignment`),

  updateAlignment: (textId: string, links: AlignmentLinkDTO[]) =>
    request<AlignmentDTO>(`/texts/${textId}/alignment`, {
      method: "PUT",
      body: JSON.stringify({ links }),
    }),

  lookupWord: async (word: string): Promise<string | null> => {
    try {
      const result = await request<DictionaryLookupDTO>(`/dictionary/${encodeURIComponent(word.toLowerCase())}`);
      return result.translations;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },

  getVocabulary: () => request<VocabularyItemDTO[]>("/vocabulary"),

  getWeakWords: () => request<VocabularyItemDTO[]>("/vocabulary/weak"),

  startWeakWordsSession: () => request<WeakWordsSessionDTO>("/vocabulary/weak/session", { method: "POST" }),

  createRecallSession: (text_id: string, mode: RecallMode) =>
    request<RecallSessionDTO>("/recall/sessions", {
      method: "POST",
      body: JSON.stringify({ text_id, mode }),
    }),

  submitRecallAttempt: (params: {
    recall_session_id: string;
    sentence_id: string;
    typed: string;
    blanks?: BlankDTO[];
    correct_characters: number;
    incorrect_characters: number;
    total_characters: number;
    duration_seconds: number;
  }) =>
    request<RecallAttemptDTO>("/recall/attempts", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  finishRecallSession: (sessionId: string) =>
    request<void>(`/recall/sessions/${sessionId}/finish`, { method: "PATCH" }),

  createDictationSession: (text_id: string) =>
    request<DictationSessionDTO>("/dictation/sessions", {
      method: "POST",
      body: JSON.stringify({ text_id }),
    }),

  submitDictationAttempt: (params: {
    dictation_session_id: string;
    sentence_id: string;
    typed: string;
    correct_characters: number;
    incorrect_characters: number;
    total_characters: number;
    duration_seconds: number;
  }) =>
    request<DictationAttemptDTO>("/dictation/attempts", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  finishDictationSession: (sessionId: string) =>
    request<void>(`/dictation/sessions/${sessionId}/finish`, { method: "PATCH" }),

  // <audio src> can't carry an Authorization header, so audio is fetched as a blob
  // and exposed as an Object URL instead. Caller is responsible for revoking it
  // (URL.revokeObjectURL) once no longer needed.
  getDictationAudioUrl: async (sentenceId: string): Promise<string> => {
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}/dictation/audio/${sentenceId}`, { headers });
    if (!response.ok) throw new ApiError(response.status, response.statusText);

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },
};
