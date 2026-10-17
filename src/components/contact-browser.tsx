"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ContactAvatar } from "@/components/contact-avatar";
import { Input } from "@/components/ui/input";
import type { ContactSummary } from "@/lib/data";

// Case-insensitive, and treats "ё" as "е": "Семён" is found by "семен"
function normalize(text: string): string {
  return text.toLocaleLowerCase("ru").replaceAll("ё", "е").trim();
}

export function ContactBrowser({ contacts }: { contacts: ContactSummary[] }) {
  const [query, setQuery] = useState("");

  if (contacts.length === 0) {
    return (
      <p className="rounded-28 bg-gray p-6 text-center text-16 leading-body text-pretty text-ink-soft md:rounded-32 md:p-8">
        Контактов пока нет. Нажмите «Добавить контакт», чтобы создать первый.
      </p>
    );
  }

  const search = normalize(query);
  const visible = search
    ? contacts.filter((contact) => normalize(contact.name).includes(search))
    : contacts;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4.5 size-4.5 -translate-y-1/2 text-muted" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Найти по имени"
          aria-label="Найти по имени"
          className="rounded-pill pl-11.5"
        />
      </div>

      {visible.length === 0 ? (
        <p className="p-6 text-center text-16 text-muted">
          Никого не нашлось по запросу «{query.trim()}»
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5 rounded-28 bg-gray p-2 md:rounded-32 md:p-3">
          {visible.map((contact) => (
            <li key={contact.id}>
              <Link
                href={`/contacts/${contact.id}`}
                className="flex items-center gap-3 rounded-20 p-3 transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-accent md:rounded-24 md:p-3.5"
              >
                <ContactAvatar
                  name={contact.name}
                  className="size-10 text-14 md:size-11 md:text-15"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-16 font-semibold md:text-17">
                    {contact.name}
                  </span>
                  {contact.about && (
                    <span className="text-14 text-muted">{contact.about}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
