"use client";

import type { FormEvent, KeyboardEvent, RefObject } from "react";

interface TypingCaptureInputProps {
  inputRef: RefObject<HTMLInputElement>;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onInput: (e: FormEvent<HTMLInputElement>) => void;
}

/** The typing engine's real capture point -- a native input whose keystrokes drive
 * useTypingSession. Its value is irrelevant and reset after every keystroke; the
 * characters actually typed are rendered elsewhere (TypingText / MissingWordsText).
 *
 * On desktop it can be fully invisible and zero-sized because `.focus()` is called
 * programmatically from a click anywhere on the surrounding text. Mobile Safari and
 * Chrome refuse to raise the on-screen keyboard for a zero-size input even when
 * focus() fires from a genuine tap, so on a touch-primary device (`pointer: coarse`)
 * this renders as a real, directly tappable bar instead of collapsing to nothing. */
export function TypingCaptureInput({ inputRef, onKeyDown, onInput }: TypingCaptureInputProps) {
  return (
    <input
      ref={inputRef}
      placeholder="Toca aqui y escribi"
      inputMode="text"
      className="opacity-0 absolute h-0 w-0 pointer-events-none text-base [@media(pointer:coarse)]:static [@media(pointer:coarse)]:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:h-12 [@media(pointer:coarse)]:w-full [@media(pointer:coarse)]:mb-4 [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:bg-gray-900 [@media(pointer:coarse)]:border [@media(pointer:coarse)]:border-gray-800 [@media(pointer:coarse)]:rounded [@media(pointer:coarse)]:text-white"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      onKeyDown={onKeyDown}
      onInput={onInput}
    />
  );
}

