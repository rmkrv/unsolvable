import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unsolvable — Think through difficult mathematics",
  description:
    "An AI-assisted mathematical whiteboard for deliberate practice, precise diagnosis, and collaborative problem-solving.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
};

export const viewport: Viewport = {
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
    <html lang="en" data-theme="unsolvable">
      <body className="antialiased">{children}</body>
    </html>
  );
}
