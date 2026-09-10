"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import { ConfirmModal } from "@/components/ConfirmModal";
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [translation, setTranslation] = useState("");
  const [chunkMode, setChunkMode] = useState<ChunkMode>("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hasHydrated, token, router, refresh]);

  useEffect(() => {
    const hasPending = texts.some((t) => t.status === "pending" || t.status === "processing");
    if (!hasPending) return;
    const timer = setInterval(() => refresh().catch(() => {}), 2000);
    return () => clearInterval(timer);
  }, [texts, refresh]);

  useEffect(() => {
    if (!showCreateModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowCreateModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCreateModal]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.createText(title.trim() || "Texto sin titulo", content, chunkMode, translation.trim());
      setTitle("");
      setContent("");
      setTranslation("");
      setShowCreateModal(false);
      await refresh();
    } catch {
      setError("No se pudo guardar el texto.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    await api.deleteText(deletingId);
    setDeletingId(null);
    await refresh();
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-3xl mx-auto">
      {/* Header with Title and Add Text Action */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Library</h1>
          <p className="text-xs text-neutral-400 mt-0.5">Tus textos y fragmentos para practicar</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="bg-white hover:bg-neutral-200 text-black text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
        >
          <span>+ Agregar Texto</span>
        </button>
      </div>

      {/* Main Content: Immediate Text List */}
      {loading ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : texts.length === 0 ? (
        <div className="border border-neutral-800 rounded-2xl p-12 text-center flex flex-col items-center gap-3">
          <p className="text-gray-400 text-sm">Todavia no agregaste ningun texto a tu biblioteca.</p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="text-xs bg-neutral-900 text-cyan-400 hover:text-cyan-300 border border-neutral-700 px-4 py-2 rounded-lg font-medium transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            Agregar mi primer texto →
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {texts.map((t) => (
            <li
              key={t.id}
              className="border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-950/50 hover:border-neutral-700 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{t.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {t.status === "ready"
                    ? `${t.word_count} palabras · ${t.progress_percent}%${
                        t.has_translation ? ` · traduccion ${ALIGNMENT_LABEL[t.alignment_status]}` : ""
                      }`
                    : t.status === "failed"
                      ? `Error: ${t.error_message ?? "desconocido"}`
                      : "Procesando..."}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm shrink-0 flex-wrap">
                {t.status === "ready" && t.has_translation && t.alignment_status === "needs_review" && (
                  <button
                    type="button"
                    onClick={() => router.push(`/library/${t.id}/align`)}
                    className="text-cyan-400 hover:underline text-xs focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none rounded px-1"
                  >
                    Revisar alineacion
                  </button>
                )}
                {t.status === "ready" && (
                  <button
                    type="button"
                    onClick={() => router.push(`/practice/${t.id}`)}
                    className="text-white hover:text-cyan-300 font-medium text-xs bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                  >
                    Practicar
                  </button>
                )}
                {t.status === "ready" && (
                  <button
                    type="button"
                    onClick={() => router.push(`/recall/${t.id}`)}
                    className="text-gray-300 hover:text-white text-xs px-2 py-1 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none rounded"
                  >
                    Recall
                  </button>
                )}
                {t.status === "ready" && (
                  <button
                    type="button"
                    onClick={() => router.push(`/dictation/${t.id}`)}
                    className="text-gray-300 hover:text-white text-xs px-2 py-1 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none rounded"
                  >
                    Dictation
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDeletingId(t.id)}
                  className="text-gray-400 hover:text-red-400 text-xs px-2 py-1 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none rounded"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Accessible Creation Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-text-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 id="create-text-title" className="text-lg font-bold text-white">
                Agregar Nuevo Texto
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Cerrar modal"
                className="text-neutral-400 hover:text-white text-lg p-1 rounded focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="text-title" className="block text-xs text-neutral-400 mb-1">
                  Título
                </label>
                <input
                  id="text-title"
                  placeholder="ej: Alice in Wonderland - Chapter 1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white text-sm focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                />
              </div>

              <div>
                <label htmlFor="text-content" className="block text-xs text-neutral-400 mb-1">
                  Texto en inglés <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="text-content"
                  required
                  placeholder="Pega aquí el texto en inglés..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white text-sm focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none font-mono"
                />
              </div>

              <div>
                <label htmlFor="text-translation" className="block text-xs text-neutral-400 mb-1">
                  Traducción al español <span className="text-neutral-500">(opcional)</span>
                </label>
                <textarea
                  id="text-translation"
                  placeholder="Traducción humana al español para referencia exacta (sin IA)..."
                  value={translation}
                  onChange={(e) => setTranslation(e.target.value)}
                  rows={4}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white text-sm focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none font-mono"
                />
              </div>

              <div>
                <label htmlFor="chunk-mode" className="block text-xs text-neutral-400 mb-1">
                  Modo de división
                </label>
                <select
                  id="chunk-mode"
                  value={chunkMode}
                  onChange={(e) => setChunkMode(e.target.value as ChunkMode)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white text-sm focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                >
                  {CHUNK_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs text-neutral-400 hover:text-white rounded-xl focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-white hover:bg-neutral-200 text-black rounded-xl px-5 py-2 text-xs font-semibold disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                >
                  {submitting ? "Guardando..." : "Guardar texto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={deletingId !== null}
        title="Eliminar este texto?"
        description={texts.find((t) => t.id === deletingId)?.title}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
