"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import type { AlignmentStatus, ChunkMode, TextDTO } from "@/types";

const ALIGNMENT_LABEL: Record<AlignmentStatus, string> = {
  not_provided: "",
  needs_review: "pendiente de revision",
  confirmed: "confirmada",
};

const CHUNK_MODES: { value: ChunkMode; label: string }[] = [
  { value: "short", label: "Corto (30-50 palabras)" },
  { value: "normal", label: "Normal (60-80 palabras)" },
  { value: "long", label: "Largo (100-150 palabras)" },
  { value: "continuous", label: "Continuo (sin dividir)" },
];

export default function LibraryPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [texts, setTexts] = useState<TextDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [translation, setTranslation] = useState("");
  const [chunkMode, setChunkMode] = useState<ChunkMode>("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await api.listTexts();
    setTexts(data);
    return data;
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    refresh().finally(() => setLoading(false));
  }, [hasHydrated, token, router, refresh]);

  useEffect(() => {
    const hasPending = texts.some((t) => t.status === "pending" || t.status === "processing");
    if (!hasPending) return;
    const timer = setInterval(() => refresh(), 2000);
    return () => clearInterval(timer);
  }, [texts, refresh]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.createText(title.trim() || "Texto sin titulo", content, chunkMode, translation.trim());
      setTitle("");
      setContent("");
      setTranslation("");
      await refresh();
    } catch {
      setError("No se pudo guardar el texto.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar este texto?")) return;
    await api.deleteText(id);
    await refresh();
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-white mb-8">Library</h1>

      <form onSubmit={handleCreate} className="space-y-3 mb-10 border border-gray-800 rounded p-4">
        <label htmlFor="text-title" className="sr-only">
          Titulo
        </label>
        <input
          id="text-title"
          placeholder="Titulo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-600"
        />
        <label htmlFor="text-content" className="sr-only">
          Texto en ingles
        </label>
        <textarea
          id="text-content"
          required
          placeholder="Pega aqui el texto en ingles..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-600"
        />
        <label htmlFor="text-translation" className="sr-only">
          Traduccion completa al espanol
        </label>
        <textarea
          id="text-translation"
          placeholder="Traduccion completa al espanol (opcional) - la usaremos como referencia oficial, sin IA"
          value={translation}
          onChange={(e) => setTranslation(e.target.value)}
          rows={6}
          className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-600"
        />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <label htmlFor="chunk-mode" className="sr-only">
            Modo de division
          </label>
          <select
            id="chunk-mode"
            value={chunkMode}
            onChange={(e) => setChunkMode(e.target.value as ChunkMode)}
            className="bg-gray-900 border border-gray-800 rounded px-3 py-2 text-white text-sm"
          >
            {CHUNK_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="bg-white text-black rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Guardando..." : "Agregar texto"}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </form>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : texts.length === 0 ? (
        <p className="text-gray-400 text-sm">Todavia no agregaste ningun texto.</p>
      ) : (
        <ul className="space-y-3">
          {texts.map((t) => (
            <li key={t.id} className="border border-gray-800 rounded p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-white truncate">{t.title}</p>
                <p className="text-xs text-gray-400">
                  {t.status === "ready"
                    ? `${t.word_count} palabras · ${t.progress_percent}%${
                        t.has_translation ? ` · traduccion ${ALIGNMENT_LABEL[t.alignment_status]}` : ""
                      }`
                    : t.status === "failed"
                      ? `Error: ${t.error_message ?? "desconocido"}`
                      : "Procesando..."}
                </p>
              </div>
              <div className="flex gap-3 text-sm shrink-0">
                {t.status === "ready" && t.has_translation && t.alignment_status === "needs_review" && (
                  <button
                    onClick={() => router.push(`/library/${t.id}/align`)}
                    className="text-cyan-400 underline"
                  >
                    Revisar alineacion
                  </button>
                )}
                {t.status === "ready" && (
                  <button onClick={() => router.push(`/practice/${t.id}`)} className="text-white underline">
                    Abrir
                  </button>
                )}
                {t.status === "ready" && (
                  <button onClick={() => router.push(`/recall/${t.id}`)} className="text-white underline">
                    Recall
                  </button>
                )}
                {t.status === "ready" && (
                  <button onClick={() => router.push(`/dictation/${t.id}`)} className="text-white underline">
                    Dictation
                  </button>
                )}
                <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-500">
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
