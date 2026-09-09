import { useAuthStore } from "@/stores/authStore";
import type { ChunkDTO, ChunkMode, ErrorInput, OverviewStatsDTO, SessionDTO, TextDTO } from "@/types";

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

  createText: (title: string, raw_content: string, chunk_mode: ChunkMode) =>
    request<TextDTO>("/texts", {
      method: "POST",
      body: JSON.stringify({ title, raw_content, chunk_mode }),
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
};
