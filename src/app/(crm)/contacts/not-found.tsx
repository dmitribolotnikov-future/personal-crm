import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function ContactNotFound() {
  return (
    <div className="flex flex-col items-start gap-5">
      <h1 className="text-34 leading-heading font-bold tracking-tight-40">
        Контакт не найден
      </h1>
      <Link href="/" className={buttonVariants()}>
        К списку контактов
      </Link>
    </div>
  );
}
