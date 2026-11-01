import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ContactAvatar } from "@/components/contact-avatar";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getGroup, listGroupContacts } from "@/lib/data";
import { parseId } from "@/lib/validation";

export default function GroupPage({ params }: PageProps<"/groups/[id]">) {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <Link
        href="/groups"
        className={buttonVariants({
          variant: "ghost",
          className: "self-start",
        })}
      >
        Все группы
      </Link>
      <Suspense fallback={<Skeleton className="h-64 rounded-28" />}>
        <GroupDetails params={params} />
      </Suspense>
    </div>
  );
}

async function GroupDetails({
  params,
}: {
  params: PageProps<"/groups/[id]">["params"];
}) {
  const id = parseId((await params).id);
  if (id === null) notFound();
  const [group, contacts] = await Promise.all([
    getGroup(id),
    listGroupContacts(id),
  ]);
  if (!group) notFound();

  return (
    <>
      <h1 className="text-34 leading-heading font-bold tracking-tight-40 break-words md:text-42 md:tracking-tight-45">
        {group.name}
      </h1>
      <section
        className="flex flex-col gap-4"
        aria-labelledby={`group-members-${group.id}`}
      >
        <h2
          id={`group-members-${group.id}`}
          className="text-26 leading-heading font-bold tracking-tight-25"
        >
          Участники
        </h2>
        {contacts.length === 0 ? (
          <p className="text-16 text-muted">
            В этой группе пока нет участников.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5 rounded-28 bg-gray p-2 md:rounded-32 md:p-3">
            {contacts.map((contact) => (
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
                    <span className="text-16 font-semibold break-words md:text-17">
                      {contact.name}
                    </span>
                    {contact.about && (
                      <span className="text-14 text-muted">
                        {contact.about}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
