"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Keystroke, CharStatus } from '@/types/typing';
import { TypingDisplay } from './TypingDisplay';

interface SessionReplayProps {
  targetText: string;
  keystrokes: Keystroke[];
  onClose: () => void;
}

export function SessionReplay({ targetText, keystrokes, onClose }: SessionReplayProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  
  const animationRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);

  const totalDuration = useMemo(() => {
    if (keystrokes.length === 0) return 0;
    return keystrokes[keystrokes.length - 1].timestamp - keystrokes[0].timestamp;
  }, [keystrokes]);

  // Derived state based on current time
  const currentKeystrokeIndex = useMemo(() => {
    if (keystrokes.length === 0) return -1;
    const targetTime = keystrokes[0].timestamp + currentTimeMs;
    let idx = -1;
    for (let i = 0; i < keystrokes.length; i++) {
      if (keystrokes[i].timestamp <= targetTime) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [currentTimeMs, keystrokes]);

  const { charStates, currentIndex } = useMemo(() => {
    const states: CharStatus[] = Array(targetText.length).fill("pending");
    if (currentKeystrokeIndex < 0) return { charStates: states, currentIndex: 0 };
    
    let cIdx = 0;
    for (let i = 0; i <= currentKeystrokeIndex; i++) {
      const k = keystrokes[i];
      if (k.key === 'Backspace') {
        cIdx = Math.max(0, cIdx - 1);
        states[cIdx] = "pending";
      } else {
        // If it's a normal character
        states[k.charIndex] = k.correct ? "correct" : "incorrect";
        cIdx = k.charIndex + 1;
      }
    }
    return { charStates: states, currentIndex: cIdx };
  }, [currentKeystrokeIndex, keystrokes, targetText.length]);

  const playLoop = useCallback((timestamp: number) => {
    if (!lastFrameTimeRef.current) lastFrameTimeRef.current = timestamp;
    const delta = timestamp - lastFrameTimeRef.current;
    lastFrameTimeRef.current = timestamp;

    if (isPlaying) {
      setCurrentTimeMs(prev => {
        const nextTime = prev + delta * speed;
        if (nextTime >= totalDuration) {
          setIsPlaying(false);
          return totalDuration;
        }
        return nextTime;
      });
    }

    animationRef.current = requestAnimationFrame(playLoop);
  }, [isPlaying, speed, totalDuration]);

  useEffect(() => {
    lastFrameTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(playLoop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [playLoop]);

  const progress = totalDuration > 0 ? (currentTimeMs / totalDuration) * 100 : 0;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTimeMs((val / 100) * totalDuration);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-primary)] flex flex-col p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-8 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Session Replay</h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto max-w-5xl mx-auto w-full flex flex-col justify-center">
        <div className="relative p-8 bg-[var(--bg-surface)] rounded-xl shadow-sm border border-[var(--border-color)]">
          <TypingDisplay 
            targetText={targetText}
            charStates={charStates}
            currentIndex={currentIndex}
          />
        </div>
      </div>

      <div className="max-w-5xl mx-auto w-full mt-8 bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-color)]">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-[var(--accent)] text-white hover:brightness-110 transition-all shadow-md"
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>

          <input 
            type="range" 
            min="0" 
            max="100" 
            step="0.1" 
            value={progress} 
            onChange={handleSeek}
            className="flex-1 h-2 bg-[var(--bg-primary)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]" 
          />

          <div className="flex bg-[var(--bg-primary)] rounded-lg p-1 border border-[var(--border-color)]">
            {[1, 2, 4].map(s => (
              <button 
                key={s}
                onClick={() => setSpeed(s as 1|2|4)}
                className={`px-3 py-1 rounded text-sm font-bold transition-colors ${speed === s ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between text-xs text-[var(--text-muted)] font-mono">
          <span>{(currentTimeMs / 1000).toFixed(1)}s</span>
          <span>{(totalDuration / 1000).toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
}
