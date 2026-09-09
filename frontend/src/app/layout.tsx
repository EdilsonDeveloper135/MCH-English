import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCH English",
  description: "Practica mecanografia mientras aprendes ingles.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-black text-gray-200 antialiased min-h-screen">{children}</body>
    </html>
  );
}
