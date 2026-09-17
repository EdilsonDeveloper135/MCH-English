"use client";

import React, { useState, useEffect, type FormEvent } from "react";
import { api } from "@/services/api";
import { PDFImporter, MAX_IMPORT_CHARS } from "./PDFImporter";
import { EpubImporter } from "./EpubImporter";
import type { ChunkMode, TextDTO } from "@/types";

interface ImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newText: TextDTO) => void;
  initialTitle?: string;
  initialContent?: string;
  initialTab?: "paste" | "pdf" | "epub";
}

const CHUNK_MODES: { value: ChunkMode; label: string }[] = [
  { value: "short", label: "Corto (30-50 palabras)" },
  { value: "normal", label: "Normal (60-80 palabras)" },
  { value: "long", label: "Largo (100-150 palabras)" },
  { value: "continuous", label: "Continuo (sin dividir)" },
];

export function ImporterModal({
  isOpen,
  onClose,
  onCreated,
  initialTitle = "",
  initialContent = "",
  initialTab = "paste",
}: ImporterModalProps) {
  const [activeTab, setActiveTab] = useState<"paste" | "pdf" | "epub">(initialTab);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [translation, setTranslation] = useState("");
  const [chunkMode, setChunkMode] = useState<ChunkMode>("normal");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialTitle) setTitle(initialTitle);
      if (initialContent) setContent(initialContent);
      if (initialTab) setActiveTab(initialTab);
      setError(null);
      setSuccessNotice(null);
    }
  }, [isOpen, initialTitle, initialContent, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleExtracted = (extractedTitle: string, extractedContent: string, source: "PDF" | "ePub") => {
    setTitle(extractedTitle);
    setContent(extractedContent);
    setError(null);
    setSuccessNotice(`¡${source} importado correctamente! (${extractedContent.length.toLocaleString()} caracteres). Puedes revisarlo antes de guardar.`);
    setActiveTab("paste");
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setError("El contenido del texto no puede estar vacío.");
      return;
    }

    if (content.length > MAX_IMPORT_CHARS) {
      setError("El contenido supera el límite máximo de 500 KB.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const created = await api.createText(
        title.trim() || "Texto sin título",
        content,
        chunkMode,
        translation.trim()
      );
      setTitle("");
      setContent("");
      setTranslation("");
      onCreated(created);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar el texto.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const charCount = content.length;
  const isOverLimit = charCount > MAX_IMPORT_CHARS;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Agregar Nuevo Texto"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 id="importer-modal-title" className="text-lg font-bold text-white tracking-tight">
              Agregar Nuevo Texto
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Pega texto directamente o extrae localmente desde un archivo PDF o ePub
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Offline Privacy Guarantee Badge */}
        <div className="px-6 pt-3 pb-2 bg-neutral-900">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
            <span>🔒</span>
            <span>
              <strong>100% Offline & Local:</strong> Tus archivos se procesan exclusivamente en tu navegador. Ningún dato se envía a servidores externos ni APIs de IA.
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800 px-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("paste")}
            className={`py-2.5 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "paste"
                ? "border-cyan-400 text-cyan-400 font-semibold"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <span>📝</span>
            <span>Pegar texto</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pdf")}
            className={`py-2.5 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "pdf"
                ? "border-cyan-400 text-cyan-400 font-semibold"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <span>📄</span>
            <span>Importar PDF</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("epub")}
            className={`py-2.5 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "epub"
                ? "border-cyan-400 text-cyan-400 font-semibold"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <span>📚</span>
            <span>Importar ePub</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 bg-red-950/40 border border-red-800/80 rounded-xl text-red-300 text-xs font-mono"
            >
              {error}
            </div>
          )}

          {successNotice && (
            <div
              role="status"
              className="p-3 bg-cyan-950/40 border border-cyan-800/80 rounded-xl text-cyan-300 text-xs font-mono flex items-center justify-between"
            >
              <span>{successNotice}</span>
              <button
                type="button"
                onClick={() => setSuccessNotice(null)}
                className="text-cyan-400 hover:text-cyan-200 text-sm ml-2"
                aria-label="Cerrar notificación"
              >
                ✕
              </button>
            </div>
          )}

          {activeTab === "paste" && (
            <form id="importer-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="text-title" className="block text-xs font-mono text-neutral-400 mb-1">
                  Título del texto
                </label>
                <input
                  id="text-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Alice in Wonderland"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-400 font-sans"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="text-content" className="text-xs font-mono text-neutral-400">
                    Contenido en inglés *
                  </label>
                  <span
                    className={`text-[11px] font-mono ${
                      isOverLimit ? "text-red-400 font-bold" : "text-neutral-500"
                    }`}
                  >
                    {charCount.toLocaleString()} / {MAX_IMPORT_CHARS.toLocaleString()} car.
                  </span>
                </div>
                <textarea
                  id="text-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  placeholder="Pega aquí el texto en inglés..."
                  required
                  className={`w-full bg-neutral-950 border rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none font-mono resize-y ${
                    isOverLimit
                      ? "border-red-500 focus:border-red-400"
                      : "border-neutral-800 focus:border-cyan-400"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-neutral-400 mb-1">
                  Traducción en español <span className="text-neutral-600">(opcional para Modo Aprendizaje)</span>
                </label>
                <textarea
                  value={translation}
                  onChange={(e) => setTranslation(e.target.value)}
                  rows={3}
                  placeholder="Traducción paralela opcional para alinear automáticamente con Gale-Church..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-400 font-mono resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-neutral-400 mb-1">
                  Modo de división (Chunks)
                </label>
                <select
                  value={chunkMode}
                  onChange={(e) => setChunkMode(e.target.value as ChunkMode)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-cyan-400"
                >
                  {CHUNK_MODES.map((mode) => (
                    <option key={mode.value} value={mode.value} className="bg-neutral-900">
                      {mode.label}
                    </option>
                  ))}
                </select>
              </div>
            </form>
          )}

          {activeTab === "pdf" && (
            <PDFImporter
              onExtracted={(t, c) => handleExtracted(t, c, "PDF")}
              onError={(err) => setError(err)}
            />
          )}

          {activeTab === "epub" && (
            <EpubImporter
              onExtracted={(t, c) => handleExtracted(t, c, "ePub")}
              onError={(err) => setError(err)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-mono text-neutral-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          {activeTab === "paste" && (
            <button
              type="submit"
              form="importer-form"
              disabled={submitting || isOverLimit || !content.trim()}
              className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs font-mono rounded-xl transition-all shadow-md hover:shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Guardando..." : "Guardar texto"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
