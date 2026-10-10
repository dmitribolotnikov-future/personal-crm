import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { deleteContact } from "@/app/actions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { NoteForm } from "@/components/note-form";
import { NoteItem } from "@/components/note-item";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getContact, listNotes } from "@/lib/data";
import { formatDateTime, phoneHref } from "@/lib/format";
import { parseId } from "@/lib/validation";

export default function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Все контакты
      </Link>
      <Suspense fallback={<ContactSkeleton />}>
        <ContactDetails params={params} />
      </Suspense>
    </div>
  );
}

async function ContactDetails({
  params,
}: {
  params: PageProps<"/contacts/[id]">["params"];
}) {
  const id = parseId((await params).id);
  if (id === null) notFound();

  const [contact, notes] = await Promise.all([getContact(id), listNotes(id)]);
  if (!contact) notFound();

  const details = [
    { label: "Откуда знакомы", value: contact.howWeMet, href: null },
    {
      label: "Телефон",
      value: contact.phone,
      href: contact.phone && phoneHref(contact.phone),
    },
    {
      label: "Почта",
      value: contact.email,
      href: contact.email && `mailto:${contact.email}`,
    },
  ].filter((detail) => detail.value);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">{contact.name}</CardTitle>
          {contact.about && <CardDescription>{contact.about}</CardDescription>}
        </CardHeader>
        {details.length > 0 && (
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
              {details.map((detail) => (
                <div
                  key={detail.label}
                  className="flex flex-col gap-0.5 sm:contents"
                >
                  <dt className="text-muted-foreground">{detail.label}</dt>
                  <dd className="break-words whitespace-pre-wrap">
                    {detail.href ? (
                      <a href={detail.href} className="underline-offset-4 hover:underline">
                        {detail.value}
                      </a>
                    ) : (
                      detail.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        )}
        <CardContent className="flex gap-2">
          <Link
            href={`/contacts/${contact.id}/edit`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Pencil />
            Изменить
          </Link>
          <ConfirmDeleteDialog
            title={`Удалить контакт «${contact.name}»?`}
            description="Контакт и все его заметки удалятся навсегда, восстановить их будет нельзя."
            action={deleteContact.bind(null, contact.id)}
          />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-lg font-semibold">Заметки</h2>
        <NoteForm contactId={contact.id} />
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Заметок пока нет.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {notes.map((note) => (
              <NoteItem
                key={note.id}
                id={note.id}
                body={note.body}
                dateLabel={formatDateTime(note.createdAt)}
                edited={note.updatedAt > note.createdAt}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function ContactSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-24" />
    </div>
  );
}
