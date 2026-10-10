import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="font-heading text-2xl font-semibold">Ничего не нашлось</h1>
      <p className="text-muted-foreground">
        Такой страницы нет. Возможно, контакт удалили.
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        К списку контактов
      </Link>
    </div>
  );
}
