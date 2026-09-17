"use client";

import React, { useState, useRef } from "react";
import { MAX_IMPORT_CHARS } from "./PDFImporter";

interface EpubImporterProps {
  onExtracted: (title: string, content: string) => void;
  onError: (error: string) => void;
}

export function EpubImporter({ onExtracted, onError }: EpubImporterProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function processEpubFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".epub")) {
      onError("Por favor selecciona un archivo con formato .epub");
      return;
    }

    setIsProcessing(true);
    setProgressMsg("Iniciando motor ePub...");

    try {
      const epubModule = await import("epubjs");
      const ePubFn = typeof epubModule.default === "function" ? epubModule.default : (epubModule as unknown as typeof epubModule.default);

      setProgressMsg("Leyendo archivo en memoria...");
      const arrayBuffer = await file.arrayBuffer();
      const book = ePubFn(arrayBuffer);

      await book.ready;
      setProgressMsg("Extrayendo estructura y metadatos...");

      let title = file.name.replace(/\.epub$/i, "").trim() || "Libro ePub";
      try {
        const metadata = await book.loaded.metadata;
        if (metadata?.title && metadata.title.trim()) {
          title = metadata.title.trim();
        }
      } catch {
        // Fallback to filename
      }

      await book.loaded.spine;
      const spineItems = book.spine?.items || [];
      if (spineItems.length === 0) {
        throw new Error("No se encontraron secciones legibles en el ePub.");
      }

      const chapterTexts: string[] = [];
      let totalChars = 0;

      for (let i = 0; i < spineItems.length; i++) {
        setProgressMsg(`Extrayendo sección ${i + 1} de ${spineItems.length}...`);
        const item = spineItems[i];

        try {
          const doc = await item.load(book.load.bind(book));
          let plainText = "";

          if (typeof doc === "string") {
            const parser = new DOMParser();
            const parsedDoc = parser.parseFromString(doc, "text/html");
            plainText = parsedDoc.body?.textContent || "";
          } else if (doc && typeof doc === "object") {
            const docObj = doc as unknown as {
              body?: { innerText?: string | null; textContent?: string | null };
              textContent?: string | null;
            };
            if (docObj.body) {
              plainText = docObj.body.innerText || docObj.body.textContent || "";
            } else if (docObj.textContent) {
              plainText = docObj.textContent;
            }
          }

          plainText = plainText.replace(/\s+/g, " ").trim();

          if (plainText) {
            chapterTexts.push(plainText);
            totalChars += plainText.length;
          }

          if (totalChars > MAX_IMPORT_CHARS) {
            throw new Error("El texto extraído supera el límite de 500 KB para práctica fluida.");
          }
        } catch (itemErr: unknown) {
          if (
            itemErr instanceof Error &&
            itemErr.message.includes("supera el límite")
          ) {
            throw itemErr;
          }
          // Non-fatal error for an individual image-only or cover item, continue
        } finally {
          item.unload?.();
        }
      }

      book.destroy?.();

      const fullText = chapterTexts.join("\n\n").trim();

      if (!fullText || fullText.length === 0) {
        throw new Error(
          "No se pudo extraer texto legible del ePub seleccionado."
        );
      }

      onExtracted(title, fullText);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error inesperado al procesar el archivo ePub.";
      onError(msg);
    } finally {
      setIsProcessing(false);
      setProgressMsg(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isProcessing) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processEpubFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isProcessing) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  return (
    <div className="space-y-4">
      <div
        role="region"
        aria-label="Zona de carga de ePub"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[220px] ${
          isDragOver
            ? "border-emerald-400 bg-emerald-400/5 scale-[0.99]"
            : "border-neutral-700 hover:border-neutral-500 bg-neutral-900/50 hover:bg-neutral-900"
        } ${isProcessing ? "opacity-60 pointer-events-none" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".epub,application/epub+zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processEpubFile(file);
          }}
          disabled={isProcessing}
        />

        {isProcessing ? (
          <div className="flex flex-col items-center space-y-3" role="status">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-mono text-emerald-400">{progressMsg}</p>
            <p className="text-xs text-neutral-500">Extrayendo capítulos localmente en tu navegador...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="w-12 h-12 mx-auto rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 text-2xl">
              📚
            </div>
            <p className="text-sm font-semibold text-white">
              Haz clic para seleccionar un ePub o arrástralo aquí
            </p>
            <p className="text-xs text-neutral-400 font-mono">
              Máximo 500 KB de texto extraído • Extracción automática de capítulos
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
