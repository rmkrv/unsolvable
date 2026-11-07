import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unsolvable — AI Engineering Tutor",
  description:
    "A live engineering whiteboard where your connected AI assistant observes, verifies, speaks, and draws with you.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
