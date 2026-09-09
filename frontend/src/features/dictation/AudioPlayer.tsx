"use client";

import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setLoading(true);
    setUrl(null);

    api.getDictationAudioUrl(sentenceId).then((u) => {
      if (cancelled) {
        URL.revokeObjectURL(u);
        return;
      }
      objectUrl = u;
      setUrl(u);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sentenceId]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, url]);

  function handlePlay() {
    audioRef.current?.play();
  }

  function handleRepeat() {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  }

  return (
    <div className="flex items-center gap-3 mb-8">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={url ?? undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button
        onClick={handlePlay}
        disabled={loading || !url}
        className="bg-white text-black rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Cargando..." : playing ? "Reproduciendo..." : "Reproducir"}
      </button>
      <button
        onClick={handleRepeat}
        disabled={loading || !url}
        className="border border-gray-700 text-gray-300 rounded px-4 py-2 text-sm disabled:opacity-50"
      >
        Repetir
      </button>
      <select
        value={speed}
        onChange={(e) => setSpeed(parseFloat(e.target.value))}
        className="bg-gray-900 border border-gray-800 rounded px-2 py-2 text-sm text-white"
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
