"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/services/api";

const SPEEDS = [0.75, 1, 1.25, 1.5];

interface AudioPlayerProps {
  sentenceId: string;
}

export function AudioPlayer({ sentenceId }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setUrl(null);

    api
      .getDictationAudioUrl(sentenceId)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u);
        setLoading(false);
      })
      .catch(() => {
        // Without this the button stayed on "Cargando..." forever whenever synthesis
        // failed, with no way to retry.
        if (cancelled) return;
        setLoading(false);
        setError("No se pudo cargar el audio de esta oracion.");
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sentenceId, reloadToken]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, url]);

  const handlePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
  }, []);

  const handleRepeat = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+Space or Cmd+Space toggles play/pause
      if ((e.ctrlKey || e.metaKey) && (e.code === "Space" || e.key === " ")) {
        e.preventDefault();
        handlePlay();
      } else if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        handleRepeat();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePlay, handleRepeat]);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-8">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={url ?? undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={handlePlay}
        disabled={loading || !url}
        aria-label="Reproducir audio (Ctrl+Espacio)"
        className="bg-white text-black rounded px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
      >
        <span>{loading ? "Cargando..." : playing ? "Pausar" : "Reproducir"}</span>
        <kbd className="text-[10px] bg-neutral-200 text-neutral-800 px-1 py-0.5 rounded font-mono">
          Ctrl+Space 🔊
        </kbd>
      </button>
      <button
        type="button"
        onClick={handleRepeat}
        disabled={loading || !url}
        aria-label="Repetir audio desde el inicio (Alt+R)"
        className="border border-gray-700 text-gray-300 rounded px-4 py-2 text-sm disabled:opacity-50 flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none hover:text-white"
      >
        <span>Repetir</span>
        <kbd className="text-[10px] bg-neutral-800 text-gray-300 px-1 py-0.5 rounded font-mono">
          Alt+R ↺
        </kbd>
      </button>
      {error && (
        <span className="flex items-center gap-2 text-xs text-red-300">
          {error}
          <button
            type="button"
            onClick={() => setReloadToken((n) => n + 1)}
            className="underline hover:text-red-200 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none rounded"
          >
            Reintentar
          </button>
        </span>
      )}
      <label htmlFor="playback-speed" className="sr-only">
        Velocidad de reproducción
      </label>
      <select
        id="playback-speed"
        value={speed}
        onChange={(e) => setSpeed(parseFloat(e.target.value))}
        className="bg-gray-900 border border-gray-800 rounded px-2 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}x
          </option>
        ))}
      </select>
    </div>
  );
}
