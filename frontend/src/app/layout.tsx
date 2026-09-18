import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ClientOverlays } from "@/components/ClientOverlays";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

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
    icon: "/icon-192.svg",
    apple: "/icon-192.svg",
  },
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
