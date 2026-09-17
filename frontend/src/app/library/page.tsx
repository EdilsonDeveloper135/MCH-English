"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { AlignmentStatus, ChunkMode, TextDTO } from "@/types";

const ImporterModal = dynamic(
  () => import("@/features/import/ImporterModal").then((m) => m.ImporterModal),
  { ssr: false }
);

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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await api.listTexts();
    setTexts(data);
    return data;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("import") === "quicktype") {
      try {
        const raw = sessionStorage.getItem("quicktype_save_text");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.title) setTitle(parsed.title);
          if (parsed.content) setContent(parsed.content);
          setShowCreateModal(true);
          sessionStorage.removeItem("quicktype_save_text");
        }
      } catch {
        // ignore parse error
      }
    }
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

      {/* Advanced Client-Side Importer Modal (Paste, PDF, ePub) */}
      <ImporterModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setTitle("");
          setContent("");
        }}
        onCreated={async (newText) => {
          setTexts((prev) => [newText, ...prev]);
          await refresh();
        }}
        initialTitle={title}
        initialContent={content}
      />

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
