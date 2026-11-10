import { Suspense } from "react";

import { createContact } from "@/app/actions";
import { ContactForm } from "@/components/contact-form";
import { Skeleton } from "@/components/ui/skeleton";
import { listGroups } from "@/lib/data";

export default function NewContactPage() {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <h1 className="text-34 leading-heading font-bold tracking-tight-40 md:text-42 md:tracking-tight-45">
        Новый контакт
      </h1>
      <Suspense fallback={<Skeleton className="h-96 rounded-28" />}>
        <NewContactForm />
      </Suspense>
    </div>
  );
}

async function NewContactForm() {
  const groups = await listGroups();
  return (
    <ContactForm
      action={createContact}
      groups={groups}
      submitLabel="Добавить"
      cancelHref="/"
    />
  );
}
