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
  GamificationOverviewDTO,
  HistoryPointDTO,
  OverviewStatsDTO,
  PhraseDTO,
  RecallAttemptDTO,
  RecallMode,
  RecallSessionDTO,
  SessionDTO,
  TextDTO,
  TranslationMode,
  UserSettingsDTO,
  VocabularyBucketDTO,
  VocabularyItemDTO,
  WeakWordsSessionDTO,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Dictionary entries never change at runtime, so a repeated lookup of the same word
// (e.g. the same typo made twice in one session) is served from memory instead of
// firing another request -- keyed lowercase, module-scoped so it survives across
// components/pages for the lifetime of the tab.
const dictionaryCache = new Map<string, string | null>();

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** FastAPI/Pydantic 422 responses carry `detail` as an array of validation error
 * objects (`{msg, loc, type, ...}`), not a string -- passed straight through, it
 * stringifies to "[object Object]" wherever it's rendered. Ordinary `HTTPException`
 * responses already send a plain string, which passes through untouched. */
function formatErrorDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (item && typeof item === "object" && "msg" in item ? String(item.msg) : null))
      .filter((msg): msg is string => Boolean(msg));
    if (messages.length > 0) return messages.join("; ");
  }
  return fallback;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // Only an *authenticated* request rejected with 401/403 means the token itself is
  // expired/revoked -- /auth/login and /auth/register also return 401/409 for wrong
  // credentials, but those requests never carry a token, so `token` being set here
  // is what distinguishes "your session died" from "you typed the wrong password".
  if ((response.status === 401 || response.status === 403) && token) {
    // Every page already redirects to /login once the store's token goes null
    // (each page's hasHydrated/token effect), so clearing it here is enough to get
    // the user off an indefinite loading screen instead of a full page reload.
    const message = "Tu sesion expiro. Inicia sesion de nuevo.";
    useAuthStore.getState().logout(message);
    throw new ApiError(response.status, message);
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = formatErrorDetail(body.detail, detail);
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

  logout: () => request<void>("/auth/logout", { method: "POST" }),

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

  // Only the fields the API defines: the typing engine's stats object also carries the
  // full per-character state and the WPM history, which the server ignores and which
  // would otherwise travel on every finished session.
  finishSession: (sessionId: string, stats: FinishSessionPayload) =>
    request<SessionDTO>(`/sessions/${sessionId}`, {
      method: "PATCH",
      body: JSON.stringify({
        correct_characters: stats.correct_characters,
        incorrect_characters: stats.incorrect_characters,
        total_characters: stats.total_characters,
        duration_seconds: stats.duration_seconds,
        errors: stats.errors,
      }),
    }),

  getOverview: () => request<OverviewStatsDTO>("/statistics/overview"),

  getHistory: (days?: number) =>
    request<HistoryPointDTO[]>(`/statistics/history${days ? `?days=${days}` : ""}`),

  getVocabularyDistribution: () => request<VocabularyBucketDTO[]>("/statistics/vocabulary-distribution"),

  getSettings: () => request<UserSettingsDTO>("/settings"),

  updateSettings: (updates: { translation_mode?: TranslationMode; daily_goal_minutes?: number }) =>
    request<UserSettingsDTO>("/settings", {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  getGamificationOverview: () => request<GamificationOverviewDTO>("/gamification/overview"),

  updateGrammarNote: (textId: string, sentenceId: string, grammar_note: string | null) =>
    request<{ grammar_note: string | null }>(`/texts/${textId}/sentences/${sentenceId}/grammar-note`, {
      method: "PATCH",
      body: JSON.stringify({ grammar_note }),
    }),

  addPhrase: (textId: string, sentenceId: string, english_phrase: string, spanish_phrase: string) =>
    request<PhraseDTO>(`/texts/${textId}/sentences/${sentenceId}/phrases`, {
      method: "POST",
      body: JSON.stringify({ english_phrase, spanish_phrase }),
    }),

  deletePhrase: (textId: string, sentenceId: string, phraseId: string) =>
    request<void>(`/texts/${textId}/sentences/${sentenceId}/phrases/${phraseId}`, { method: "DELETE" }),

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
    const key = word.toLowerCase();
    if (dictionaryCache.has(key)) return dictionaryCache.get(key)!;

    try {
      const result = await request<DictionaryLookupDTO>(`/dictionary/${encodeURIComponent(key)}`);
      dictionaryCache.set(key, result.translations);
      return result.translations;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // A word genuinely missing from the dictionary stays missing -- caching the
        // miss too means mistyping the same word again never re-fires the request.
        dictionaryCache.set(key, null);
        return null;
      }
      throw err;
    }
  },

  getVocabulary: () => request<VocabularyItemDTO[]>("/vocabulary"),

  getWeakWords: () => request<VocabularyItemDTO[]>("/vocabulary/weak"),

  startWeakWordsSession: (word?: string) =>
    request<WeakWordsSessionDTO>(
      `/vocabulary/weak/session${word ? `?word=${encodeURIComponent(word)}` : ""}`,
      { method: "POST" }
    ),

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
