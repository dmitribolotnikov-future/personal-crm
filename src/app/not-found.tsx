import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 md:gap-5">
      <h1 className="text-34 leading-heading font-bold tracking-tight-40 text-balance md:text-42 md:tracking-tight-45">
        Ничего не нашлось
      </h1>
      <p className="max-w-130 text-17 leading-lead text-pretty text-ink-soft">
        Такой страницы нет. Возможно, контакт удалили.
      </p>
      <Link href="/" className={buttonVariants()}>
        К списку контактов
      </Link>
    </div>
  );
}
