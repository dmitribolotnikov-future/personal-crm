import { notFound } from "next/navigation";
import { Suspense } from "react";

import { updateContact } from "@/app/actions";
import { ContactForm } from "@/components/contact-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getContact } from "@/lib/data";
import { parseId } from "@/lib/validation";

export default function EditContactPage({
  params,
}: PageProps<"/contacts/[id]/edit">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold">Изменить контакт</h1>
      <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
        <EditContactForm params={params} />
      </Suspense>
    </div>
  );
}

async function EditContactForm({
  params,
}: {
  params: PageProps<"/contacts/[id]/edit">["params"];
}) {
  const id = parseId((await params).id);
  if (id === null) notFound();

  const contact = await getContact(id);
  if (!contact) notFound();

  return (
    <ContactForm
      action={updateContact.bind(null, contact.id)}
      defaultValues={{
        name: contact.name,
        about: contact.about ?? "",
        howWeMet: contact.howWeMet ?? "",
        phone: contact.phone ?? "",
        email: contact.email ?? "",
      }}
      submitLabel="Сохранить"
      cancelHref={`/contacts/${contact.id}`}
    />
  );
}
