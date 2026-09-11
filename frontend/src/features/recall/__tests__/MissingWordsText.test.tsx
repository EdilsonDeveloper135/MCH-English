import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MissingWordsText, buildBlankTargetText } from "../MissingWordsText";
import type { BlankDTO } from "@/types";

describe("buildBlankTargetText", () => {
  it("extracts and concatenates blanked words with a single space", () => {
    const content = "The quick brown fox jumps";
    const blanks: BlankDTO[] = [
      { start: 4, end: 9 },
      { start: 16, end: 19 },
    ];

    expect(buildBlankTargetText(content, blanks)).toBe("quick fox");
  });
});

describe("MissingWordsText", () => {
  const content = "The quick fox";
  const blanks: BlankDTO[] = [{ start: 4, end: 9 }];

  it("renders non-blank text correctly alongside distinct blank cells", () => {
    const { container } = render(
      <MissingWordsText
        content={content}
        blanks={blanks}
        charStates={["pending", "pending", "pending", "pending", "pending"]}
        currentIndex={0}
      />
    );

    expect(container.textContent).toContain("The ");
    expect(container.textContent).toContain(" fox");

    // Check that there are 5 blank cell spans rendered for "quick"
    const blankCells = container.querySelectorAll("span.border-b-2");
    expect(blankCells.length).toBe(5);
  });

  it("renders typed correct and incorrect characters with appropriate state classes", () => {
    const { container } = render(
      <MissingWordsText
        content={content}
        blanks={blanks}
        charStates={["correct", "incorrect", "pending", "pending", "pending"]}
        currentIndex={2}
      />
    );

    // First char is 'q' (correct -> text-white)
    expect(container.textContent).toContain("q");
    const correctSpan = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "q"
    );
    expect(correctSpan).toHaveClass("text-white");

    // Second char is 'u' (incorrect -> text-red-500)
    expect(container.textContent).toContain("u");
    const incorrectSpan = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "u"
    );
    expect(incorrectSpan).toHaveClass("text-red-500");
  });
});
