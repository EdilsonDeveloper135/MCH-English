"use client";

import { useEffect, useState } from "react";

export interface SmartRetryProps {
  problematicWord: string | null;
  onStartPractice: (word: string) => void;
  onDismiss: () => void;
}

export function SmartRetry({ problematicWord, onStartPractice, onDismiss }: SmartRetryProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (problematicWord) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 300); // Wait for fade out animation
      }, 8000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [problematicWord, onDismiss]);

  if (!problematicWord && !isVisible) return null;

  return (
    <div
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-auto transition-all duration-300 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div 
        className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-4 py-2 text-sm font-medium hover:bg-amber-500/20 transition-colors flex items-center gap-2 shadow-lg backdrop-blur-sm"
      >
        <button
          className="cursor-pointer"
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onStartPractice(problematicWord!), 300);
          }}
        >
          Practice: <span className="font-bold">{problematicWord}</span>
        </button>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onDismiss, 300);
          }}
          className="text-amber-400/50 hover:text-amber-400 ml-2"
          aria-label="Dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  );
}
