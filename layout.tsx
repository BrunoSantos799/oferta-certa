import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oferta Certa Hub",
  description: "Encontre, organize e prepare ofertas para seu grupo de promoções.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Oferta Certa",
    statusBarStyle: "black-translucent",
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/app-icon-192.png",
    shortcut: "/favicon.svg",
    apple: "/app-icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#111722",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
