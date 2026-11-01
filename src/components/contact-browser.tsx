"use client";

import { ChevronDown, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ContactAvatar } from "@/components/contact-avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ContactSummary, GroupSummary } from "@/lib/data";
import { filterContacts, getContactFilterGroups, resolveGroupFilters } from "@/lib/contact-filter";

export function ContactBrowser({ contacts, groups }: { contacts: ContactSummary[]; groups: GroupSummary[] }) {
  const [query, setQuery] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const groupIds = resolveGroupFilters(selectedGroupIds, groups);
  const visible = filterContacts(contacts, query, groupIds);
  const selectedGroups = groups.filter((group) => groupIds.includes(group.id));
  const selectedNames = selectedGroups.map((group) => group.name);
  const filterLabel = selectedNames.length > 0 ? selectedNames.join(", ") : "Все контакты";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-14 font-semibold text-ink-soft">Группы</span>
        <details className="group/filter min-w-0">
          <summary
            role="button"
            aria-label={`Фильтр по группам: ${filterLabel}`}
            title={filterLabel}
            className="flex min-h-12 w-full min-w-0 cursor-pointer list-none items-center justify-between gap-3 rounded-pill border border-line bg-white px-5 py-2 text-16 text-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent [&::-webkit-details-marker]:hidden"
          >
            <span className="min-w-0 truncate">{filterLabel}</span>
            <ChevronDown aria-hidden="true" className="size-4.5 shrink-0 text-muted transition-transform group-open/filter:rotate-180" />
          </summary>
          <fieldset className="mt-2 flex min-w-0 flex-col gap-2 rounded-20 border border-line bg-white p-3">
            <legend className="sr-only">Выбрать группы для фильтра</legend>
            <p className="px-3 text-14 leading-snug text-muted-2">
              Контакт должен входить хотя бы в одну из выбранных групп.
            </p>
            {groups.length === 0 ? (
              <p className="px-3 text-15 text-muted">Групп пока нет.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {groups.map((group) => (
                  <label key={group.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-12 px-3 py-2 hover:bg-gray">
                    <input
                      type="checkbox"
                      checked={groupIds.includes(group.id)}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSelectedGroupIds((current) => {
                          const active = resolveGroupFilters(current, groups);
                          return checked
                            ? [...active, group.id]
                            : active.filter((id) => id !== group.id);
                        });
                      }}
                      className="size-4 shrink-0 accent-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
                    />
                    <span className="min-w-0 text-15 break-words">{group.name}</span>
                  </label>
                ))}
              </div>
            )}
            {groupIds.length > 0 && (
              <Button type="button" variant="ghost" className="self-start" onClick={() => setSelectedGroupIds([])}>
                Все контакты
              </Button>
            )}
          </fieldset>
        </details>
      </div>
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
          {contacts.length === 0 && groupIds.length === 0 && !query.trim()
            ? "Контактов пока нет. Нажмите «Добавить контакт», чтобы создать первый."
            : query.trim()
              ? `Никого не нашлось по запросу «${query.trim()}»${groupIds.length === 0 ? "" : " в выбранных группах"}`
              : "Нет контактов в выбранных группах"}
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5 rounded-28 bg-gray p-2 md:rounded-32 md:p-3">
          {visible.map((contact) => {
            const matchingGroups = getContactFilterGroups(contact.groupIds, selectedGroups);
            return (
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
                  {matchingGroups.length > 0 && (
                    <span
                      role="group"
                      aria-label="Выбранные группы контакта"
                      className="mt-1 flex flex-wrap gap-1"
                    >
                      {matchingGroups.map((group) => (
                        <span
                          key={group.id}
                          className="max-w-full rounded-pill bg-white px-2.5 py-1 text-12 font-medium break-words text-ink-soft"
                        >
                          {group.name}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
