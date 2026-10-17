import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { ContactBrowser } from "@/components/contact-browser";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listContacts } from "@/lib/data";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-34 leading-heading font-bold tracking-tight-40 md:text-42 md:tracking-tight-45">
          Контакты
        </h1>
        <Link href="/contacts/new" className={buttonVariants({ size: "lg" })}>
          <Plus />
          Добавить контакт
        </Link>
      </div>
      <Suspense fallback={<ContactListSkeleton />}>
        <Contacts />
      </Suspense>
    </div>
  );
}

async function Contacts() {
  const contacts = await listContacts();
  return <ContactBrowser contacts={contacts} />;
}

function ContactListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-12 rounded-pill" />
      <Skeleton className="h-96 rounded-28 md:rounded-32" />
    </div>
  );
}
