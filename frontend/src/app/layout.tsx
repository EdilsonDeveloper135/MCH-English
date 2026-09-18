import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ClientOverlays } from "@/components/ClientOverlays";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCH English",
  description: "Practica mecanografia mientras aprendes ingles.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MCH English",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      {/* Colors come from the theme variables in globals.css -- hardcoding bg-black
          here won over them and left the light (Sepia) theme unreadable. */}
      <body className="antialiased min-h-screen">
        <AppHeader />
        {children}
        <ClientOverlays />
      </body>
    </html>
  );
}
