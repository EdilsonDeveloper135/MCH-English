import type { SentenceRange } from "@/features/typing/useTypingSession";

export const MAX_QUICKTYPE_WORDS = 2000;

export interface ClientSentence {
  id: string;
  text: string;
  start: number;
  end: number;
}

export interface ClientChunk {
  index: number;
  text: string;
  sentences: ClientSentence[];
  sentenceRanges: SentenceRange[];
  wordCount: number;
}

export function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

/**
 * Basic client-side sentence splitter.
 * Note: This is an ephemeral client-side tokenizer and does NOT replace the intelligent
 * backend Gale-Church chunking worker.
 */
export function splitSentencesClient(rawText: string): string[] {
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // Match sentences ending in punctuation (.!? or newline) followed by space and uppercase or end of text
  const rawSentences: string[] = [];
  const regex = /[^.!?\n]+(?:[.!?]+["']?|\n+|$)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    const s = match[0].trim();
    if (s) {
      rawSentences.push(s);
    }
  }

  return rawSentences.length > 0 ? rawSentences : [normalized];
}

/**
 * Groups sentences into practice chunks of ~50 to 80 words without breaking sentences.
 */
export function buildClientChunks(rawText: string, targetChunkWords = 65): ClientChunk[] {
  const sentences = splitSentencesClient(rawText);
  if (sentences.length === 0) return [];

  const chunks: ClientChunk[] = [];
  let currentChunkSentences: string[] = [];
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sWords = countWords(sentence);
    if (currentWordCount > 0 && currentWordCount + sWords > targetChunkWords + 20) {
      // Finalize current chunk
      chunks.push(assembleChunk(chunks.length, currentChunkSentences));
      currentChunkSentences = [sentence];
      currentWordCount = sWords;
    } else {
      currentChunkSentences.push(sentence);
      currentWordCount += sWords;
    }
  }

  if (currentChunkSentences.length > 0) {
    chunks.push(assembleChunk(chunks.length, currentChunkSentences));
  }

  return chunks;
}

function assembleChunk(index: number, sentences: string[]): ClientChunk {
  const chunkText = sentences.join(" ");
  const sentenceRanges: SentenceRange[] = [];
  const clientSentences: ClientSentence[] = [];

  let cursor = 0;
  for (let i = 0; i < sentences.length; i++) {
    const sText = sentences[i];
    const sId = `client-s-${index}-${i}`;
    const start = cursor;
    const end = start + sText.length;

    sentenceRanges.push({ sentenceId: sId, start, end });
    clientSentences.push({ id: sId, text: sText, start, end });

    // account for the space separator between sentences
    cursor = end + 1;
  }

  return {
    index,
    text: chunkText,
    sentences: clientSentences,
    sentenceRanges,
    wordCount: countWords(chunkText),
  };
}
