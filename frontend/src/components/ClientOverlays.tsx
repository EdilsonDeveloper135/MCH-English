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

export function ClientOverlays() {
  return (
    <>
      <CommandPaletteWrapper />
      <QuickPractice />
    </>
  );
}
