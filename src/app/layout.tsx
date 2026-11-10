import type { Metadata } from "next";
import { JetBrains_Mono, Onest } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/logo";
import { AccountHeader } from "@/components/account-header";

import "./globals.css";

// Same fonts as the landing; the variables are used in tokens.css
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  fallback: ["system-ui", "sans-serif"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "cyrillic"],
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "Мои контакты",
  description: "Личная CRM: люди, которых я знаю лично",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${onest.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-bg font-sans leading-normal text-ink">
        <header className="mx-auto flex w-full max-w-200 flex-wrap items-center justify-between gap-3 px-5 pt-5.5 md:px-10 md:py-7">
          <Link
            href="/"
            className="rounded-12 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
          >
            <Logo className="text-20 md:text-24" />
          </Link>
          <Suspense fallback={null}>
            <AccountHeader />
          </Suspense>
        </header>
        <main className="mx-auto w-full max-w-200 flex-1 px-5 pt-8 pb-16 md:px-10 md:pt-4 md:pb-24">
          {children}
        </main>
      </body>
    </html>
  );
}
