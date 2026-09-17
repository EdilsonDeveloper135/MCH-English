import { describe, it, expect } from "vitest";
import { countWords, splitSentencesClient, buildClientChunks } from "../clientChunking";

describe("clientChunking", () => {
  it("correctly counts words in a sentence", () => {
    expect(countWords("Hello world from QuickType")).toBe(4);
    expect(countWords("   ")).toBe(0);
  });

  it("splits text into sentences by punctuation", () => {
    const text = "First sentence. Second sentence! Third sentence? And fourth.";
    const sentences = splitSentencesClient(text);
    expect(sentences.length).toBe(4);
    expect(sentences[0]).toBe("First sentence.");
    expect(sentences[1]).toBe("Second sentence!");
    expect(sentences[2]).toBe("Third sentence?");
    expect(sentences[3]).toBe("And fourth.");
  });

  it("builds chunks respecting sentence boundaries", () => {
    const text =
      "Sentence one is simple. Sentence two is slightly longer to add words. Sentence three concludes this part.";
    const chunks = buildClientChunks(text, 10);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].sentences.length).toBeGreaterThan(0);
    expect(chunks[0].sentenceRanges.length).toBe(chunks[0].sentences.length);
    expect(chunks[0].text).toContain("Sentence one is simple.");
  });
});
