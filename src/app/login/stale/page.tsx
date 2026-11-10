import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function StaleLinkPage() {
  return (
    <section className="flex flex-col items-start gap-6">
      <h1 className="text-34 leading-heading font-bold tracking-tight-40">
        Ссылка устарела, запроси новую
      </h1>
      <Link href="/login" className={buttonVariants({ size: "lg" })}>
        Получить новую ссылку
      </Link>
    </section>
  );
}
