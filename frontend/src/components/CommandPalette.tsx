"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTypingStore } from "@/stores/typingStore";
import type { CursorStyle, SoundProfile, StatsVisibility, ThemeMode } from "@/types/typing";

interface Command {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  action: () => void;
}

const MAX_VISIBLE = 8;

function fuzzyScore(query: string, text: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qIdx = 0;
  let score = 0;

  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) {
      score += 1;
      qIdx++;
    }
  }

  return qIdx === q.length ? score : 0;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const setPreference = useTypingStore((s) => s.setPreference);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Every command maps to something the app really does; the palette used to list 25
  // entries whose action was a console.log.
  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    const theme = (value: ThemeMode) => () => setPreference("theme", value);
    const sound = (value: SoundProfile) => () => setPreference("soundProfile", value);
    const cursor = (value: CursorStyle) => () => setPreference("cursorStyle", value);
    const stats = (value: StatsVisibility) => () => setPreference("statsVisibility", value);

    return [
      { id: "go-library", label: "Ir a Biblioteca", category: "Navegación", action: go("/library") },
      { id: "go-vocabulary", label: "Ir a Vocabulario", category: "Navegación", action: go("/vocabulary") },
      { id: "go-progress", label: "Ir a Progreso", category: "Navegación", action: go("/progress") },
      { id: "go-gamification", label: "Ir a Gamificación", category: "Navegación", action: go("/gamification") },
      { id: "go-settings", label: "Ir a Ajustes", category: "Navegación", action: go("/settings") },
      {
        id: "practice-weak",
        label: "Practicar palabras débiles",
        category: "Práctica",
        action: go("/practice/weak-words"),
      },
      { id: "theme-oled", label: "Tema: OLED", category: "Apariencia", action: theme("oled") },
      { id: "theme-nord", label: "Tema: Nord", category: "Apariencia", action: theme("nord") },
      { id: "theme-catppuccin", label: "Tema: Catppuccin", category: "Apariencia", action: theme("catppuccin") },
      { id: "theme-sepia", label: "Tema: Sepia", category: "Apariencia", action: theme("sepia") },
      { id: "sound-off", label: "Sonido: apagado", category: "Sonido", action: sound("off") },
      { id: "sound-mechanical", label: "Sonido: mecánico", category: "Sonido", action: sound("mechanical") },
      { id: "sound-soft", label: "Sonido: suave", category: "Sonido", action: sound("soft") },
      { id: "sound-minimal", label: "Sonido: mínimo", category: "Sonido", action: sound("minimal") },
      { id: "cursor-line", label: "Cursor: línea", category: "Escritura", action: cursor("line") },
      { id: "cursor-block", label: "Cursor: bloque", category: "Escritura", action: cursor("block") },
      { id: "cursor-underline", label: "Cursor: subrayado", category: "Escritura", action: cursor("underline") },
      { id: "stats-minimal", label: "Métricas: mínimas", category: "Escritura", action: stats("minimal") },
      { id: "stats-normal", label: "Métricas: normales", category: "Escritura", action: stats("normal") },
      { id: "stats-advanced", label: "Métricas: avanzadas", category: "Escritura", action: stats("advanced") },
    ];
  }, [router, setPreference]);

  const visibleCommands = useMemo(() => {
    if (!query) return commands.slice(0, MAX_VISIBLE);
    return commands
      .map((cmd) => ({ cmd, score: fuzzyScore(query, cmd.label) + fuzzyScore(query, cmd.category) * 0.5 }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_VISIBLE)
      .map((entry) => entry.cmd);
  }, [commands, query]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSelectedIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const selected = listRef.current?.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, visibleCommands.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter": {
          e.preventDefault();
          const command = visibleCommands[selectedIndex];
          if (command) {
            command.action();
            onClose();
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, visibleCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  let currentCategory = "";

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-start pt-[20vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        className="w-full max-w-lg bg-[var(--bg-surface)] border border-neutral-800 rounded-xl shadow-2xl overflow-hidden animate-scaleIn flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <label htmlFor="command-palette-input" className="sr-only">
          Buscar comandos
        </label>
        <input
          id="command-palette-input"
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-list"
          autoComplete="off"
          className="w-full px-4 py-3 bg-transparent border-b border-neutral-800 text-[var(--text-primary)] placeholder-neutral-500 outline-none text-sm"
          placeholder="Buscar comandos..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div id="command-palette-list" ref={listRef} role="listbox" className="max-h-[320px] overflow-y-auto py-2">
          {visibleCommands.length === 0 ? (
            <p className="px-4 py-8 text-center text-neutral-500 text-sm">Sin resultados para &quot;{query}&quot;</p>
          ) : (
            visibleCommands.map((cmd, index) => {
              const showHeader = cmd.category !== currentCategory;
              currentCategory = cmd.category;
              const isSelected = index === selectedIndex;

              return (
                <div key={cmd.id}>
                  {showHeader && (
                    <div className="px-4 py-1.5 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      {cmd.category}
                    </div>
                  )}
                  <div
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={-1}
                    data-selected={isSelected}
                    className={`px-4 py-2.5 flex justify-between items-center cursor-pointer text-sm ${
                      isSelected
                        ? "bg-white/5 text-[var(--text-primary)]"
                        : "text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-primary)]"
                    }`}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => {
                      cmd.action();
                      onClose();
                    }}
                  >
                    <span>{cmd.label}</span>
                    {cmd.shortcut && <span className="text-neutral-500 font-mono text-xs">{cmd.shortcut}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function CommandPaletteWrapper() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleGlobalKeydown);
    return () => window.removeEventListener("keydown", handleGlobalKeydown);
  }, []);

  return <CommandPalette isOpen={isOpen} onClose={() => setIsOpen(false)} />;
}
