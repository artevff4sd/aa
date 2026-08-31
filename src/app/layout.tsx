import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pepe Star - خرید گیفت و استار تلگرامی",
  description: "خرید گیفت‌ها و استارهای تلگرامی با قیمت مناسب - Pepe Star",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-slate-900 text-white antialiased">{children}</body>
    </html>
  );
}
