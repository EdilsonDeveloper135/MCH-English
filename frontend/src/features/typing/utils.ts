import type { ErrorInput } from "@/types";
import type { CharStatus } from "@/features/typing/useTypingSession";

/** Rebuilds what the user actually typed from the target text plus the recorded
 * errors -- used by Dictation/Recall result screens to show "Escribiste: ...".
 * A position can have been retyped (Backspace then a different wrong character),
 * so only the *last* error recorded at each position reflects the final attempt. */
export function reconstructTyped(targetText: string, charStates: CharStatus[], errors: ErrorInput[]): string {
  const lastTypedAtPosition = new Map<number, string>();
  for (const err of errors) lastTypedAtPosition.set(err.position, err.typed_char);

  return targetText
    .split("")
    .map((char, i) => (charStates[i] === "incorrect" ? (lastTypedAtPosition.get(i) ?? "?") : char))
    .join("");
}
