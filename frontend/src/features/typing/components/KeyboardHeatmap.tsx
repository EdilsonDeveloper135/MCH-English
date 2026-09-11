"use client";

import React, { useState } from 'react';
import { PerKeyStats } from '@/types/typing';
import { useTypingStore } from '@/stores/typingStore';

interface KeyboardHeatmapProps {
  onPracticeKey?: (key: string) => void;
  customPerKeyStats?: Record<string, PerKeyStats>;
}

type ViewMode = 'accuracy' | 'speed' | 'errors' | 'reactionTime';

const QWERTY_ROWS = [
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'backspace'],
  ['tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
  ['caps', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'enter'],
  ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'shift_r'],
  ['ctrl', 'alt', ' ', 'alt_r', 'ctrl_r']
];

export function KeyboardHeatmap({ onPracticeKey, customPerKeyStats }: KeyboardHeatmapProps) {
  const storePerKeyStats = useTypingStore(s => s.perKeyStats);
  const stats = customPerKeyStats || storePerKeyStats;
  
  const [viewMode, setViewMode] = useState<ViewMode>('accuracy');
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const getKeyColor = (key: string) => {
    const s = stats[key];
    if (!s || s.count === 0) return 'var(--bg-primary)'; // Seldom used / Unused

    let intensity = 0;
    
    if (viewMode === 'accuracy') {
      const acc = s.correct / s.count;
      // High acc = green, Low = red
      if (acc > 0.95) return `rgba(34, 197, 94, ${acc})`;
      if (acc > 0.85) return `rgba(234, 179, 8, ${acc})`;
      return `rgba(239, 68, 68, ${1 - acc + 0.3})`;
    } else if (viewMode === 'errors') {
      intensity = Math.min(s.errors / 10, 1);
      return `rgba(239, 68, 68, ${intensity})`;
    } else if (viewMode === 'reactionTime' || viewMode === 'speed') {
      const avg = s.totalReactionMs / s.count;
      // fast < 150ms, slow > 400ms
      if (avg < 150) return 'rgba(34, 197, 94, 0.8)';
      if (avg < 300) return 'rgba(234, 179, 8, 0.7)';
      return 'rgba(239, 68, 68, 0.6)';
    }

    return 'var(--bg-primary)';
  };

  const renderTooltip = () => {
    if (!hoveredKey) return null;
    const s = stats[hoveredKey];
    if (!s || s.count === 0) return (
      <div className="absolute top-4 right-4 bg-[var(--bg-surface)] p-4 rounded shadow-lg border border-[var(--border-color)] text-sm z-10">
        <p className="font-bold uppercase mb-1">{hoveredKey}</p>
        <p className="text-[var(--text-muted)]">No data yet</p>
      </div>
    );

    const acc = Math.round((s.correct / s.count) * 100);
    const avgReaction = Math.round(s.totalReactionMs / s.count);

    return (
      <div className="absolute top-4 right-4 bg-[var(--bg-surface)] p-4 rounded shadow-lg border border-[var(--border-color)] text-sm z-10 w-48">
        <div className="flex justify-between items-center mb-2 border-b border-[var(--border-color)] pb-2">
          <p className="font-bold uppercase text-lg">{hoveredKey === ' ' ? 'Space' : hoveredKey}</p>
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${acc > 90 ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
            {acc}%
          </span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-[var(--text-muted)]">Speed:</span>
          <span className="font-mono">{avgReaction}ms</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-[var(--text-muted)]">Errors:</span>
          <span className="font-mono">{s.errors}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-[var(--text-muted)]">Total:</span>
          <span className="font-mono">{s.count} presses</span>
        </div>
        
        {onPracticeKey && s.errors > 0 && (
          <button 
            onClick={() => onPracticeKey(hoveredKey)}
            className="w-full mt-3 py-1.5 bg-[var(--bg-primary)] hover:bg-[var(--accent)] hover:text-white rounded text-xs font-medium transition-colors"
          >
            Practice this key
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-full relative flex flex-col gap-6 bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-color)]">
      
      {renderTooltip()}

      <div className="flex gap-2">
        {(['accuracy', 'speed', 'errors', 'reactionTime'] as ViewMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${
              viewMode === mode 
                ? 'bg-[var(--accent)] text-white' 
                : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {mode.replace(/([A-Z])/g, ' $1').trim()}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 max-w-4xl w-full mx-auto">
        {QWERTY_ROWS.map((row, rIndex) => (
          <div key={rIndex} className="flex gap-2 justify-center w-full">
            {row.map((key) => {
              const displayKey = key === ' ' ? 'space' : key;
              const isSpecial = key.length > 1 && key !== ' ';
              
              let widthClass = 'w-10 md:w-12';
              if (key === ' ') widthClass = 'w-64 md:w-96';
              else if (key === 'backspace') widthClass = 'w-20 md:w-24';
              else if (key === 'tab' || key === '\\') widthClass = 'w-16 md:w-20';
              else if (key === 'caps' || key === 'enter') widthClass = 'w-20 md:w-24';
              else if (key.startsWith('shift')) widthClass = 'w-24 md:w-32';
              else if (isSpecial) widthClass = 'w-14 md:w-16';

              return (
                <div
                  key={key}
                  onMouseEnter={() => setHoveredKey(key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onClick={() => {
                    if (onPracticeKey && stats[key] && stats[key].errors > 0) {
                      onPracticeKey(key);
                    }
                  }}
                  className={`${widthClass} h-10 md:h-12 rounded-lg border border-[var(--border-color)] flex items-center justify-center cursor-pointer transition-all hover:scale-105 shadow-sm relative overflow-hidden group`}
                  style={{ backgroundColor: isSpecial ? 'var(--bg-primary)' : getKeyColor(key) }}
                >
                  <span className={`text-xs font-mono select-none ${isSpecial ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)] drop-shadow-md font-bold z-10'}`}>
                    {displayKey.toUpperCase()}
                  </span>
                  
                  {/* Subtle hover overlay */}
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex justify-center gap-6 mt-4 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500 opacity-80"></div>
          <span>Good</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-500 opacity-80"></div>
          <span>Average</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500 opacity-80"></div>
          <span>Needs Practice</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]"></div>
          <span>Unused</span>
        </div>
      </div>
    </div>
  );
}
