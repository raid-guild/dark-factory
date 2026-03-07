import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dark Factory",
  description: "API-first multi-agent coordination runtime",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
