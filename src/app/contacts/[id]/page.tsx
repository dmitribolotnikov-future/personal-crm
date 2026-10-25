import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { deleteContact } from "@/app/actions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { ContactAvatar } from "@/components/contact-avatar";
import { MarkContactedButton } from "@/components/mark-contacted-button";
import { NoteForm } from "@/components/note-form";
import { NoteItem } from "@/components/note-item";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getContact, listNotes } from "@/lib/data";
import { formatCalendarDate, formatDateTime, phoneHref } from "@/lib/format";
import {
  formatOverdue,
  frequencyPhrase,
  getKeepInTouchState,
} from "@/lib/keep-in-touch";
import { cn } from "@/lib/utils";
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
    { label: "Место работы", value: contact.workplace, href: null },
  ].filter((detail) => detail.value);

  const keepInTouch = getKeepInTouchState({
    frequency: contact.contactFrequency,
    // Notes come newest first
    lastNoteAt: notes[0]?.createdAt ?? null,
    frequencySetAt: contact.contactFrequencySetAt,
  });

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

          {(details.length > 0 || contact.contactFrequency) && (
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

              {contact.contactFrequency && (
                <div className="flex flex-col gap-0.5 sm:contents">
                  <dt className="text-muted">Общаться</dt>
                  <dd>{frequencyPhrase(contact.contactFrequency)}</dd>
                </div>
              )}
              {keepInTouch && (
                <div className="flex flex-col gap-0.5 sm:contents">
                  {/* The first line is as tall as the button, so the label lines up with the text even when the button wraps below */}
                  <dt className="text-muted sm:flex sm:h-11 sm:items-center">
                    Срок
                  </dt>
                  <dd className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-2 sm:min-h-11",
                        keepInTouch.overdue && "font-semibold text-accent-ink",
                      )}
                    >
                      {keepInTouch.overdue && (
                        <span
                          aria-hidden="true"
                          className="size-2 shrink-0 rounded-circle bg-accent"
                        />
                      )}
                      {keepInTouch.overdue
                        ? `Пора связаться · ${formatOverdue(keepInTouch.overdueDays)}`
                        : `Связаться до ${formatCalendarDate(keepInTouch.dueOn)}`}
                    </span>
                    <MarkContactedButton contactId={contact.id} />
                  </dd>
                </div>
              )}
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
