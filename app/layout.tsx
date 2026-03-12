import type { Metadata } from "next";
import { Fira_Code, IM_Fell_English, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const imFell = IM_Fell_English({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

const firaCode = Fira_Code({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Dark Factory",
  description: "Beneath the Raid Guild castle, strange machinery turns.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${imFell.variable} ${sourceSans.variable} ${firaCode.variable}`}>
        {children}
      </body>
    </html>
  );
}
