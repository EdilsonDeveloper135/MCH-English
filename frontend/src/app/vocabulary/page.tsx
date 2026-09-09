"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { api, ApiError } from "@/services/api";
import type { VocabularyItemDTO } from "@/types";

export default function VocabularyPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [items, setItems] = useState<VocabularyItemDTO[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    api.getVocabulary().then(setItems);
  }, [hasHydrated, token, router]);

  async function handlePracticeWeak() {
    setError(null);
    setStarting(true);
    try {
      await api.startWeakWordsSession();
      router.push("/practice/weak-words");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? "Todavia no hay suficientes palabras debiles registradas. Segui practicando textos primero."
          : "No se pudo iniciar la practica."
      );
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-white">Vocabulary</h1>
        <div className="flex gap-4 text-sm text-gray-400">
          <Link href="/library" className="hover:text-white">
            Library
          </Link>
          <Link href="/progress" className="hover:text-white">
            Progress
          </Link>
        </div>
      </div>

      <button
        onClick={handlePracticeWeak}
        disabled={starting}
        className="bg-white text-black rounded px-4 py-2 text-sm font-medium disabled:opacity-50 mb-4"
      >
        {starting ? "Preparando..." : "Practicar palabras debiles"}
      </button>
      {error && <p className="text-red-500 text-sm mb-6">{error}</p>}

      {!items ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm">Todavia no registraste ninguna palabra. Practica un texto primero.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-800">
              <th className="py-2 font-normal">Palabra</th>
              <th className="py-2 font-normal">Traduccion</th>
              <th className="py-2 font-normal text-right">Encuentros</th>
              <th className="py-2 font-normal text-right">Errores</th>
              <th className="py-2 font-normal text-right">Mastery</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.word} className="border-b border-gray-900">
                <td className="py-2 text-white font-mono">{item.word}</td>
                <td className="py-2 text-gray-400">{item.translation ?? "-"}</td>
                <td className="py-2 text-gray-400 text-right">{item.encounters}</td>
                <td className="py-2 text-gray-400 text-right">{item.typing_errors}</td>
                <td className="py-2 text-right">
                  <MasteryBar value={item.mastery_score} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MasteryBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-green-500" : value >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-gray-400 w-10 text-right">{Math.round(value)}%</span>
      <div className="w-16 h-1.5 bg-gray-800 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}
