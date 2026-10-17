import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { deleteContact } from "@/app/actions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { ContactAvatar } from "@/components/contact-avatar";
import { NoteForm } from "@/components/note-form";
import { NoteItem } from "@/components/note-item";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getContact, listNotes } from "@/lib/data";
import { formatDateTime, phoneHref } from "@/lib/format";
import { parseId } from "@/lib/validation";

export default function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 self-start rounded-12 text-15 font-medium text-muted-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
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
      {/* A white card on a powder block, like the contact card on the landing */}
      <section className="rounded-36 bg-powder p-3 md:rounded-48 md:p-5">
        <Card>
          <div className="flex items-center gap-4">
            <ContactAvatar
              name={contact.name}
              className="size-14 text-20 md:size-16 md:text-22"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-26 leading-title font-bold tracking-tight-25 break-words md:text-34 md:leading-heading md:tracking-tight-40">
                {contact.name}
              </h1>
              {contact.about && (
                <p className="text-15 text-muted md:text-17">{contact.about}</p>
              )}
            </div>
          </div>

          {details.length > 0 && (
            <dl className="grid gap-x-6 gap-y-3 text-15 leading-snug md:text-16 sm:grid-cols-[auto_1fr]">
              {details.map((detail) => (
                <div
                  key={detail.label}
                  className="flex flex-col gap-0.5 sm:contents"
                >
                  <dt className="text-muted">{detail.label}</dt>
                  <dd className="break-words whitespace-pre-wrap">
                    {detail.href ? (
                      <a
                        href={detail.href}
                        className="underline-offset-4 hover:text-accent-ink hover:underline"
                      >
                        {detail.value}
                      </a>
                    ) : (
                      detail.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/contacts/${contact.id}/edit`}
              className={buttonVariants({ variant: "secondary" })}
            >
              <Pencil />
              Изменить
            </Link>
            <ConfirmDeleteDialog
              title={`Удалить контакт «${contact.name}»?`}
              description="Контакт и все его заметки удалятся навсегда, восстановить их будет нельзя."
              action={deleteContact.bind(null, contact.id)}
            />
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-4 pt-4 md:gap-5 md:pt-6">
        <h2 className="text-26 leading-heading font-bold tracking-tight-25 md:text-34 md:tracking-tight-40">
          Заметки
        </h2>
        <NoteForm contactId={contact.id} />
        {notes.length === 0 ? (
          <p className="text-15 text-muted">Заметок пока нет.</p>
        ) : (
          <ul className="flex flex-col gap-2.5 md:gap-4">
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
      <Skeleton className="h-64 rounded-36 md:rounded-48" />
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24 rounded-20" />
    </div>
  );
}
