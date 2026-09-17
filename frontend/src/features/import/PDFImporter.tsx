"use client";

import React, { useState, useRef } from "react";

export const MAX_IMPORT_CHARS = 500_000;

interface PDFImporterProps {
  onExtracted: (title: string, content: string) => void;
  onError: (error: string) => void;
}

export function PDFImporter({ onExtracted, onError }: PDFImporterProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function processPdfFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      onError("Por favor selecciona un archivo con formato .pdf");
      return;
    }

    setIsProcessing(true);
    setProgressMsg("Iniciando motor de lectura PDF...");

    try {
      const pdfjsLib = await import("pdfjs-dist");
      if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }

      setProgressMsg("Cargando documento en memoria...");
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const numPages = pdf.numPages;
      if (numPages === 0) {
        throw new Error("El documento no contiene páginas.");
      }

      const pagesText: string[] = [];
      let totalChars = 0;

      for (let i = 1; i <= numPages; i++) {
        setProgressMsg(`Extrayendo texto: página ${i} de ${numPages}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageStr = (textContent.items as { str?: string }[])
          .map((item) => item.str || "")
          .join(" ")
          .trim();

        if (pageStr) {
          pagesText.push(pageStr);
          totalChars += pageStr.length;
        }

        if (totalChars > MAX_IMPORT_CHARS) {
          throw new Error("El texto extraído supera el límite de 500 KB para práctica fluida.");
        }
      }

      const fullText = pagesText.join("\n\n").trim();

      if (!fullText || fullText.length === 0) {
        throw new Error(
          "Este PDF parece ser un documento escaneado o no contiene texto seleccionable. MCH-English no realiza OCR automático."
        );
      }

      const derivedTitle = file.name.replace(/\.pdf$/i, "").trim() || "Documento PDF";
      onExtracted(derivedTitle, fullText);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error inesperado al procesar el archivo PDF.";
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
      processPdfFile(files[0]);
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
        aria-label="Zona de carga de PDF"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[220px] ${
          isDragOver
            ? "border-cyan-400 bg-cyan-400/5 scale-[0.99]"
            : "border-neutral-700 hover:border-neutral-500 bg-neutral-900/50 hover:bg-neutral-900"
        } ${isProcessing ? "opacity-60 pointer-events-none" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processPdfFile(file);
          }}
          disabled={isProcessing}
        />

        {isProcessing ? (
          <div className="flex flex-col items-center space-y-3" role="status">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-mono text-cyan-400">{progressMsg}</p>
            <p className="text-xs text-neutral-500">Procesando localmente sin subir ningún archivo...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="w-12 h-12 mx-auto rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 text-2xl">
              📄
            </div>
            <p className="text-sm font-semibold text-white">
              Haz clic para seleccionar un PDF o arrástralo aquí
            </p>
            <p className="text-xs text-neutral-400 font-mono">
              Máximo 500 KB de texto extraído • Sin OCR (requiere texto seleccionable)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
