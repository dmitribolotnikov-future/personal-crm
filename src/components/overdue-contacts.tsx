import Link from "next/link";

import { ContactAvatar } from "@/components/contact-avatar";
import { MarkContactedButton } from "@/components/mark-contacted-button";
import { listOverdueContacts } from "@/lib/data";
import { formatOverdue } from "@/lib/keep-in-touch";

// "Пора связаться" on the home page: white rows on a powder block, like the contact card.
// Renders nothing when nobody is overdue. Does not depend on the search box.
export async function OverdueContacts() {
  const contacts = await listOverdueContacts();
  if (contacts.length === 0) return null;

  return (
    <section
      aria-labelledby="overdue-title"
      className="flex flex-col gap-3 md:gap-4"
    >
      <h2
        id="overdue-title"
        className="text-26 leading-heading font-bold tracking-tight-25 md:text-34 md:tracking-tight-40"
      >
        Пора связаться
      </h2>
      <ul className="flex flex-col gap-2 rounded-28 bg-powder p-2 md:rounded-32 md:p-3">
        {contacts.map((contact) => (
          // The link and the button are siblings: a button cannot live inside a link
          <li
            key={contact.id}
            className="flex flex-col gap-3 rounded-20 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:rounded-24 md:p-3.5"
          >
            <Link
              href={`/contacts/${contact.id}`}
              className="flex min-w-0 items-center gap-3 rounded-12 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
            >
              <ContactAvatar
                name={contact.name}
                className="size-10 text-14 md:size-11 md:text-15"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-16 font-semibold break-words md:text-17">
                  {contact.name}
                </span>
                <span className="text-14 font-medium text-accent-ink">
                  {formatOverdue(contact.overdueDays)}
                </span>
              </span>
            </Link>
            <MarkContactedButton contactId={contact.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}
