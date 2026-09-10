"use client";

import { useState } from "react";
import { api } from "@/services/api";
import type { PhraseDTO, SentenceDTO } from "@/types";

interface SentenceInfoPanelProps {
  textId: string;
  sentence: SentenceDTO;
  onGrammarNoteSaved: (sentenceId: string, note: string | null) => void;
  onPhraseAdded: (sentenceId: string, phrase: PhraseDTO) => void;
  onPhraseDeleted: (sentenceId: string, phraseId: string) => void;
}

export function SentenceInfoPanel({
  textId,
  sentence,
  onGrammarNoteSaved,
  onPhraseAdded,
  onPhraseDeleted,
}: SentenceInfoPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(sentence.grammar_note ?? "");
  const [showAddPhrase, setShowAddPhrase] = useState(false);
  const [englishDraft, setEnglishDraft] = useState("");
  const [spanishDraft, setSpanishDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const hasContent = Boolean(sentence.grammar_note) || sentence.phrases.length > 0 || sentence.difficult_words.length > 0;

  async function saveNote() {
    setSaving(true);
    try {
      const result = await api.updateGrammarNote(textId, sentence.id, noteDraft.trim() || null);
      onGrammarNoteSaved(sentence.id, result.grammar_note);
      setEditingNote(false);
    } finally {
      setSaving(false);
    }
  }

  async function addPhrase() {
    if (!englishDraft.trim() || !spanishDraft.trim()) return;
    setSaving(true);
    try {
      const phrase = await api.addPhrase(textId, sentence.id, englishDraft.trim(), spanishDraft.trim());
      onPhraseAdded(sentence.id, phrase);
      setEnglishDraft("");
      setSpanishDraft("");
      setShowAddPhrase(false);
    } finally {
      setSaving(false);
    }
  }

  async function removePhrase(phraseId: string) {
    await api.deletePhrase(textId, sentence.id, phraseId);
    onPhraseDeleted(sentence.id, phraseId);
  }

  return (
    <div className="mt-4 text-sm">
      <button onClick={() => setExpanded((e) => !e)} className="text-gray-600 underline text-xs">
        {expanded ? "Ocultar detalles" : hasContent ? "Ver detalles" : "Agregar detalles"}
      </button>

      {expanded && (
        <div className="mt-3 space-y-4 border-t border-gray-900 pt-3">
          {sentence.difficult_words.length > 0 && (
            <div>
              <p className="text-xs text-gray-600 mb-1">Palabras dificiles</p>
              <div className="flex flex-wrap gap-2">
                {sentence.difficult_words.map((w) => (
                  <span key={w} className="bg-gray-900 text-gray-400 text-xs px-2 py-1 rounded">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-600 mb-1">Gramatica</p>
            {editingNote ? (
              <div className="flex gap-2">
                <input
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="ej: require + noun"
                  className="flex-1 bg-gray-900 border border-gray-800 rounded px-2 py-1 text-white text-xs"
                />
                <button onClick={saveNote} disabled={saving} className="text-xs underline text-white">
                  Guardar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-gray-400 text-xs">{sentence.grammar_note ?? "Sin nota."}</p>
                <button
                  onClick={() => {
                    setNoteDraft(sentence.grammar_note ?? "");
                    setEditingNote(true);
                  }}
                  className="text-xs underline text-gray-600"
                >
                  Editar
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-600 mb-1">Frases importantes</p>
            {sentence.phrases.length > 0 && (
              <ul className="space-y-1 mb-2">
                {sentence.phrases.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-xs text-gray-400">
                    <span>
                      {p.english_phrase} = {p.spanish_phrase}
                    </span>
                    <button onClick={() => removePhrase(p.id)} className="text-gray-700 hover:text-red-500">
                      x
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {showAddPhrase ? (
              <div className="flex gap-2">
                <input
                  value={englishDraft}
                  onChange={(e) => setEnglishDraft(e.target.value)}
                  placeholder="ingles"
                  className="flex-1 bg-gray-900 border border-gray-800 rounded px-2 py-1 text-white text-xs"
                />
                <input
                  value={spanishDraft}
                  onChange={(e) => setSpanishDraft(e.target.value)}
                  placeholder="espanol"
                  className="flex-1 bg-gray-900 border border-gray-800 rounded px-2 py-1 text-white text-xs"
                />
                <button onClick={addPhrase} disabled={saving} className="text-xs underline text-white">
                  +
                </button>
              </div>
            ) : (
              <button onClick={() => setShowAddPhrase(true)} className="text-xs underline text-gray-600">
                + Agregar frase
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
