"use client";

import dynamic from "next/dynamic";

const CommandPaletteWrapper = dynamic(
  () => import("@/components/CommandPalette").then((m) => m.CommandPaletteWrapper),
  { ssr: false }
);

const QuickPractice = dynamic(
  () => import("@/components/QuickPractice").then((m) => m.QuickPractice),
  { ssr: false }
);

const PwaRegistry = dynamic(
  () => import("@/components/PwaRegistry").then((m) => m.PwaRegistry),
  { ssr: false }
);

export function ClientOverlays() {
  return (
    <>
      <CommandPaletteWrapper />
      <QuickPractice />
      <PwaRegistry />
    </>
  );
}
