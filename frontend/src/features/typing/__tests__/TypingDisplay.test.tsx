import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TypingDisplay } from "../components/TypingDisplay";
import { defaultPreferences, useTypingStore } from "@/stores/typingStore";
import type { CharStatus } from "@/types/typing";

const TARGET = "Hi there";
const states: CharStatus[] = Array(TARGET.length).fill("pending");

describe("TypingDisplay", () => {
  beforeEach(() => {
    useTypingStore.setState({ preferences: { ...defaultPreferences } });
  });

  it("sizes the reading column in characters, not pixels", () => {
    // lineWidth is a measure in `ch`; applied as `px` it rendered the whole exercise
    // inside an 80px-wide strip.
    const { container } = render(
      <TypingDisplay targetText={TARGET} charStates={states} currentIndex={0} />
    );

    const display = container.firstElementChild as HTMLElement;
    expect(display.style.maxWidth).toBe("80ch");
  });

  it("follows the configured line width", () => {
    useTypingStore.setState({ preferences: { ...defaultPreferences, lineWidth: 60 } });

    const { container } = render(
      <TypingDisplay targetText={TARGET} charStates={states} currentIndex={0} />
    );

    expect((container.firstElementChild as HTMLElement).style.maxWidth).toBe("60ch");
  });

  it("renders every character of the exercise", () => {
    const { container } = render(
      <TypingDisplay targetText={TARGET} charStates={states} currentIndex={0} />
    );

    for (let i = 0; i < TARGET.length; i++) {
      expect(container.querySelector(`[data-char-index="${i}"]`)).not.toBeNull();
    }
    expect(container.textContent).toBe(TARGET);
  });
});
