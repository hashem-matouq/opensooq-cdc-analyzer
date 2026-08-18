import type { Metadata } from "next";
import { Cairo, Inter } from "next/font/google";
import "./globals.css";

const display = Cairo({
  subsets: ["latin", "arabic"],
  weight: ["600", "700"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "OpenSooq CDC Data Analyzer",
  description:
    "Convert complicated CDC and raw technical data into clear, readable business information.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
