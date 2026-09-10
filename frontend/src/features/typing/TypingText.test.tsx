import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TypingText } from "./TypingText";
import type { CharStatus } from "./useTypingSession";

describe("TypingText", () => {
  it("renders every character of the target text", () => {
    const charStates: CharStatus[] = ["correct", "correct", "pending"];
    render(<TypingText targetText="Hi!" charStates={charStates} currentIndex={2} />);

    expect(screen.getByText("H")).toBeInTheDocument();
    expect(screen.getByText("i")).toBeInTheDocument();
    expect(screen.getByText("!")).toBeInTheDocument();
  });

  it("colors each character according to its state", () => {
    const charStates: CharStatus[] = ["correct", "incorrect", "pending"];
    render(<TypingText targetText="abc" charStates={charStates} currentIndex={2} />);

    expect(screen.getByText("a")).toHaveClass("text-white");
    expect(screen.getByText("b")).toHaveClass("text-red-500");
    expect(screen.getByText("c")).toHaveClass("text-gray-400");
  });

  it("marks the current cursor position with the cyan border", () => {
    const charStates: CharStatus[] = ["correct", "pending", "pending"];
    render(<TypingText targetText="abc" charStates={charStates} currentIndex={1} />);

    expect(screen.getByText("b")).toHaveClass("border-cyan-400");
    expect(screen.getByText("a")).not.toHaveClass("border-cyan-400");
    expect(screen.getByText("c")).not.toHaveClass("border-cyan-400");
  });

  it("replaces not-yet-typed letters with an underscore when hidePending is set, but leaves spaces alone", () => {
    const charStates: CharStatus[] = ["pending", "pending", "pending"];
    render(<TypingText targetText="a b" charStates={charStates} currentIndex={0} hidePending />);

    expect(screen.getAllByText("_")).toHaveLength(2); // "a" and "b", the space is left alone
    expect(screen.queryByText("a")).not.toBeInTheDocument();
  });

  it("keeps unrelated words rendering correctly when only one word's state changes (block-splitting regression check)", () => {
    // "correct" for "Hi", "incorrect" for the first letter of "cats", "pending" for the rest.
    const charStates: CharStatus[] = ["correct", "correct", "correct", "incorrect", "pending", "pending", "pending"];
    render(<TypingText targetText="Hi cats" charStates={charStates} currentIndex={4} />);

    expect(screen.getByText("H")).toHaveClass("text-white");
    expect(screen.getByText("i")).toHaveClass("text-white");
    expect(screen.getByText("c")).toHaveClass("text-red-500");
    expect(screen.getByText("a")).toHaveClass("text-gray-400");
    expect(screen.getByText("a")).toHaveClass("border-cyan-400");
  });
});
