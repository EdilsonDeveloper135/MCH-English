"use client";

import { useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";

interface TypingCaptureInputProps {
  inputRef: RefObject<HTMLInputElement>;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onInput: (e: FormEvent<HTMLInputElement>) => void;
  showFocusLostWarning?: boolean;
}

/** The typing engine's real capture point -- a native input whose keystrokes drive
 * useTypingSession. Its value is irrelevant and reset after every keystroke; the
 * characters actually typed are rendered elsewhere (TypingDisplay / TypingText / MissingWordsText).
 *
 * On desktop it is invisible and zero-sized with auto-refocus capability on click.
 * If focus is lost on desktop, an unobtrusive pill reminds the user to click to focus.
 * On mobile/touch devices (`pointer: coarse`), it renders as a real, directly tappable bar. */
export function TypingCaptureInput({
  inputRef,
  onKeyDown,
  onInput,
  showFocusLostWarning = true,
}: TypingCaptureInputProps) {
  const [isInputFocused, setIsInputFocused] = useState(true);

  return (
    <>
      <input
        ref={inputRef}
        placeholder="Toca aqui y escribi"
        aria-label="Area de escritura"
        inputMode="text"
        className="opacity-0 absolute h-0 w-0 pointer-events-none text-base [@media(pointer:coarse)]:static [@media(pointer:coarse)]:opacity-100 [@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:h-12 [@media(pointer:coarse)]:w-full [@media(pointer:coarse)]:mb-4 [@media(pointer:coarse)]:px-3 [@media(pointer:coarse)]:bg-gray-900 [@media(pointer:coarse)]:border [@media(pointer:coarse)]:border-gray-800 [@media(pointer:coarse)]:rounded [@media(pointer:coarse)]:text-white"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onFocus={() => setIsInputFocused(true)}
        onBlur={() => setIsInputFocused(false)}
        onKeyDown={onKeyDown}
        onInput={onInput}
      />
      {!isInputFocused && showFocusLostWarning && (
        // A pill, not a full-screen layer: the blur fires on mousedown, so a
        // `fixed inset-0` overlay appeared before the mouseup and swallowed the very
        // click that caused it -- every button on the page needed two clicks.
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none [@media(pointer:coarse)]:hidden">
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="pointer-events-auto bg-neutral-900/95 border border-neutral-700 text-neutral-300 px-5 py-2.5 rounded-full text-sm font-medium shadow-2xl flex items-center gap-2.5 hover:border-[var(--accent)] hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" aria-hidden="true" />
            Haz click aqui para seguir escribiendo
          </button>
        </div>
      )}
    </>
  );
}
