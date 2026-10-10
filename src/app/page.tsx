import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { ContactBrowser } from "@/components/contact-browser";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listContacts } from "@/lib/data";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold">Контакты</h1>
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
      <Skeleton className="h-8" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
