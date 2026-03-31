// apps/web/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { QueryProvider } from "../providers/QueryProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "KABAYAN Dashboard",
  description:
    "Flood Emergency Response & Disaster Management System — Dasmariñas, Cavite",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
