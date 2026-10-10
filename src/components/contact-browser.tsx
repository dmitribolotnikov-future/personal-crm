"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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
      <p className="rounded-xl p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
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
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Найти по имени"
          aria-label="Найти по имени"
          className="pl-8"
        />
      </div>

      {visible.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          Никого не нашлось по запросу «{query.trim()}»
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl ring-1 ring-foreground/10">
          {visible.map((contact) => (
            <li key={contact.id}>
              <Link
                href={`/contacts/${contact.id}`}
                className="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-muted"
              >
                <span className="font-medium">{contact.name}</span>
                {contact.about && (
                  <span className="text-sm text-muted-foreground">
                    {contact.about}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
