import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Мои контакты",
  description: "Личная CRM: люди, которых я знаю лично",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b">
          <div className="mx-auto flex h-14 w-full max-w-2xl items-center px-4">
            <Link href="/" className="font-heading text-lg font-semibold">
              Мои контакты
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
