"use client";

import React, { memo, useMemo, useRef, useEffect, useState } from 'react';
import { CharStatus } from '@/types/typing';
import { useTypingStore } from '@/stores/typingStore';

interface TypingDisplayProps {
  targetText: string;
  charStates: CharStatus[];
  currentIndex: number;
  extraChars?: Record<number, string[]>;
  hidePending?: boolean;
}

interface BlockProps {
  word: string;
  blockStartIndex: number;
  charStates: CharStatus[];
  currentIndex: number;
  extraChars?: Record<number, string[]>;
  hidePending?: boolean;
  reduceMotion: boolean;
  isCurrentWord: boolean;
  isNextWord: boolean;
  isNextNextWord: boolean;
  isNextNextNextWord: boolean;
  readAhead: string;
}

function areBlockPropsEqual(prev: BlockProps, next: BlockProps) {
  if (prev.word !== next.word) return false;
  if (prev.blockStartIndex !== next.blockStartIndex) return false;
  if (prev.currentIndex !== next.currentIndex) {
    const prevInBlock = prev.currentIndex >= prev.blockStartIndex && prev.currentIndex < prev.blockStartIndex + prev.word.length;
    const nextInBlock = next.currentIndex >= next.blockStartIndex && next.currentIndex < next.blockStartIndex + next.word.length;
    if (prevInBlock || nextInBlock) return false;
  }
  
  if (prev.hidePending !== next.hidePending) return false;
  if (prev.reduceMotion !== next.reduceMotion) return false;
  if (prev.isCurrentWord !== next.isCurrentWord) return false;
  if (prev.isNextWord !== next.isNextWord) return false;
  if (prev.isNextNextWord !== next.isNextNextWord) return false;
  if (prev.isNextNextNextWord !== next.isNextNextNextWord) return false;
  if (prev.readAhead !== next.readAhead) return false;

  for (let i = 0; i < prev.word.length; i++) {
    if (prev.charStates[prev.blockStartIndex + i] !== next.charStates[next.blockStartIndex + i]) {
      return false;
    }
  }

  const prevExtra = prev.extraChars ? prev.extraChars[prev.blockStartIndex] : undefined;
  const nextExtra = next.extraChars ? next.extraChars[next.blockStartIndex] : undefined;
  if (prevExtra !== nextExtra) {
    if (!prevExtra || !nextExtra) return false;
    if (prevExtra.length !== nextExtra.length) return false;
    for (let i = 0; i < prevExtra.length; i++) {
      if (prevExtra[i] !== nextExtra[i]) return false;
    }
  }

  return true;
}

const WordBlock = memo(function WordBlock({
  word,
  blockStartIndex,
  charStates,
  currentIndex,
  extraChars,
  hidePending,
  reduceMotion,
  isCurrentWord,
  isNextWord,
  isNextNextWord,
  isNextNextNextWord,
  readAhead
}: BlockProps) {
  const chars = [];
  
  let wordOpacity = 1;
  let wordWeight = 400;
  let wordScale = 1;

  if (isCurrentWord) {
    wordWeight = 500;
    if (!reduceMotion) wordScale = 1.01;
  } else if (isNextWord && (readAhead === 'easy' || readAhead === 'normal' || readAhead === 'hard')) {
    wordOpacity = 0.8;
  } else if (isNextNextWord && (readAhead === 'normal' || readAhead === 'hard')) {
    wordOpacity = 0.8;
  } else if (isNextNextNextWord && readAhead === 'hard') {
    wordOpacity = 0.8;
  }

  const blockExtraChars = extraChars ? extraChars[blockStartIndex] : undefined;

  for (let i = 0; i < word.length; i++) {
    const absoluteIndex = blockStartIndex + i;
    const status = charStates[absoluteIndex] || 'pending';
    const char = word[i];
    const isCurrentChar = absoluteIndex === currentIndex;

    let charStyle: React.CSSProperties = {
      transition: reduceMotion ? 'none' : 'color 150ms ease, opacity 150ms ease',
    };
    let charClass = 'inline-block';

    if (status === 'pending') {
      if (hidePending && !isCurrentChar) {
        charStyle.opacity = 0;
      } else {
        charStyle.color = 'var(--char-pending)';
        if (isCurrentChar) {
          charStyle.opacity = 1;
        } else {
          const distance = absoluteIndex - currentIndex;
          charStyle.opacity = (distance > 0 && distance < 50) ? 0.7 : 0.4;
        }
      }
    } else if (status === 'correct') {
      charStyle.color = 'var(--char-correct)';
    } else if (status === 'incorrect') {
      charStyle.color = 'var(--char-incorrect)';
      charStyle.backgroundColor = 'rgba(var(--char-incorrect-rgb, 239, 68, 68), 0.15)';
      if (!reduceMotion && isCurrentChar) {
        charClass += ' animate-shake';
      }
    }

    chars.push(
      <span
        key={i}
        data-char-index={absoluteIndex}
        style={charStyle}
        className={charClass}
      >
        {char}
      </span>
    );
  }

  if (blockExtraChars) {
    blockExtraChars.forEach((char, i) => {
      chars.push(
        <span
          key={`extra-${i}`}
          className="text-red-500 line-through opacity-70"
        >
          {char}
        </span>
      );
    });
  }

  return (
    <span 
      className="inline-block whitespace-pre-wrap transition-all duration-150"
      style={{
        opacity: wordOpacity,
        fontWeight: wordWeight,
        transform: `scale(${wordScale})`,
      }}
    >
      {chars}
    </span>
  );
}, areBlockPropsEqual);

export function TypingDisplay({
  targetText,
  charStates,
  currentIndex,
  extraChars,
  hidePending
}: TypingDisplayProps) {
  const preferences = useTypingStore((s) => s.preferences);
  const { fontSize, reduceMotion, readAhead, lineHeight, lineWidth } = preferences;
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  const blocks = useMemo(() => {
    const regex = /\S+|\s+/g;
    const result = [];
    let match;
    while ((match = regex.exec(targetText)) !== null) {
      result.push({
        word: match[0],
        index: match.index
      });
    }
    return result;
  }, [targetText]);

  const currentBlockIndex = useMemo(() => {
    return blocks.findIndex(b => currentIndex >= b.index && currentIndex < b.index + b.word.length);
  }, [blocks, currentIndex]);

  // A new exercise starts at the top: the accumulated offset used to carry over and
  // leave the next chunk scrolled out of the visible window.
  useEffect(() => {
    setScrollY(0);
  }, [targetText]);

  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return;

    const currentCharEl = contentRef.current.querySelector(`[data-char-index="${currentIndex}"]`) as HTMLElement;
    if (currentCharEl) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const charRect = currentCharEl.getBoundingClientRect();

      const charTopRelativeToContainer = charRect.top - containerRect.top;

      const targetOffset = 40;
      if (charTopRelativeToContainer > targetOffset + 30) {
        setScrollY(prev => prev + (charTopRelativeToContainer - targetOffset));
      }
    }
  }, [currentIndex]);

  const displayStyle: React.CSSProperties = {
    fontSize: fontSize ? `${fontSize}px` : '24px',
    lineHeight: lineHeight || '1.5',
    // `ch`, not `px`: lineWidth is a measure in characters (that is how the Settings
    // screen presents and previews it). As pixels it rendered the whole exercise in an
    // 80px-wide strip.
    maxWidth: lineWidth ? `${lineWidth}ch` : '65ch',
  };

  const scrollStyle: React.CSSProperties = {
    transform: reduceMotion ? 'none' : `translateY(-${scrollY}px)`,
    transition: reduceMotion ? 'none' : 'transform 300ms ease',
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden h-[220px] w-full mx-auto"
      style={displayStyle}
    >
      <div 
        ref={contentRef}
        style={scrollStyle}
        className="will-change-transform"
      >
        {blocks.map((block, i) => (
          <WordBlock
            key={i}
            word={block.word}
            blockStartIndex={block.index}
            charStates={charStates}
            currentIndex={currentIndex}
            extraChars={extraChars}
            hidePending={hidePending}
            reduceMotion={!!reduceMotion}
            isCurrentWord={i === currentBlockIndex}
            isNextWord={i === currentBlockIndex + 1}
            isNextNextWord={i === currentBlockIndex + 2}
            isNextNextNextWord={i === currentBlockIndex + 3}
            readAhead={readAhead || 'normal'}
          />
        ))}
      </div>
    </div>
  );
}
