"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/services/api";
import type { AlignmentDTO } from "@/types";

function formatIndices(indices: number[]): string {
  if (indices.length === 0) return "";
  const sorted = [...indices].sort((a, b) => a - b);
  const isContiguous = sorted.length > 1 && sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
  return isContiguous ? `${sorted[0]}-${sorted[sorted.length - 1]}` : sorted.join(",");
}

function parseIndices(input: string): number[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const result: number[] = [];
  for (const part of trimmed.split(",")) {
    const p = part.trim();
    if (!p) continue;
    if (p.includes("-")) {
      const [a, b] = p.split("-").map((x) => parseInt(x.trim(), 10));
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) result.push(i);
      }
    } else {
      const n = parseInt(p, 10);
      if (!Number.isNaN(n)) result.push(n);
    }
  }
  return Array.from(new Set(result));
}

export default function AlignmentReviewPage() {
  const params = useParams<{ textId: string }>();
  const textId = params.textId;
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [data, setData] = useState<AlignmentDTO | null>(null);
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    api.getAlignment(textId).then((alignment) => {
      setData(alignment);
      const byEnglish = new Map<number, number[]>();
      for (const link of alignment.links) {
        const list = byEnglish.get(link.english_index) ?? [];
        list.push(link.spanish_index);
        byEnglish.set(link.english_index, list);
      }
      const initial: Record<number, string> = {};
      alignment.english_sentences.forEach((s) => {
        initial[s.index] = formatIndices(byEnglish.get(s.index) ?? []);
      });
      setInputs(initial);
    });
  }, [hasHydrated, token, textId, router]);

  const spanishByIndex = useMemo(() => {
    const map = new Map<number, string>();
    data?.spanish_sentences.forEach((s) => map.set(s.index, s.content));
    return map;
  }, [data]);

  function preview(input: string): string {
    return parseIndices(input)
      .map((i) => spanishByIndex.get(i))
      .filter((c): c is string => Boolean(c))
      .join(" ");
  }

  async function handleConfirm() {
    if (!data) return;
    setError(null);
    setSaving(true);
    try {
      const links = data.english_sentences.flatMap((s) =>
        parseIndices(inputs[s.index] ?? "").map((spanish_index) => ({ english_index: s.index, spanish_index }))
      );
      await api.updateAlignment(textId, links);
      router.push(`/practice/${textId}`);
    } catch {
      setError("No se pudo guardar la alineacion.");
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <p className="text-gray-500 text-sm p-10">Cargando...</p>;

  return (
    <div className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold text-white">Revisar alineacion</h1>
        <button onClick={() => router.push("/library")} className="text-sm text-gray-400 hover:text-white">
          Library
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-8">
        Para cada oracion en ingles, indica el indice (o rango, ej. &quot;2-3&quot;) de la oracion en espanol
        que le corresponde. Dejalo vacio si esa oracion no tiene traduccion.
      </p>

      <div className="mb-8">
        <h2 className="text-sm text-gray-400 mb-2">Oraciones en espanol (por indice)</h2>
        <ul className="text-sm text-gray-400 space-y-1 border border-gray-800 rounded p-3 max-h-56 overflow-y-auto">
          {data.spanish_sentences.map((s) => (
            <li key={s.index}>
              <span className="text-cyan-400 font-mono mr-2">{s.index}</span>
              {s.content}
            </li>
          ))}
          {data.spanish_sentences.length === 0 && <li className="text-gray-600">(sin oraciones en espanol)</li>}
        </ul>
      </div>

      <div className="space-y-4">
        {data.english_sentences.map((s) => (
          <div key={s.index} className="border border-gray-800 rounded p-4">
            <p className="text-white text-sm mb-2">
              <span className="text-cyan-400 font-mono mr-2">{s.index}</span>
              {s.content}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                value={inputs[s.index] ?? ""}
                onChange={(e) => setInputs((prev) => ({ ...prev, [s.index]: e.target.value }))}
                placeholder="ej. 0 o 0-1 (vacio = sin traduccion)"
                className="bg-gray-900 border border-gray-800 rounded px-3 py-1.5 text-white text-sm w-56 focus:outline-none focus:border-gray-600"
              />
              <p className="text-sm text-gray-400 flex-1 min-w-0">
                {preview(inputs[s.index] ?? "") || <span className="text-gray-600">sin traduccion</span>}
              </p>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

      <button
        onClick={handleConfirm}
        disabled={saving}
        className="mt-8 bg-white text-black rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Confirmar alineacion"}
      </button>
    </div>
  );
}
