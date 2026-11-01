import Link from "next/link";
import { Suspense } from "react";

import { createGroup, deleteGroup, renameGroup } from "@/app/actions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { GroupForm } from "@/components/group-form";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listGroups } from "@/lib/data";

export default function GroupsPage() {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <Link
        href="/"
        className={buttonVariants({
          variant: "ghost",
          className: "self-start",
        })}
      >
        Все контакты
      </Link>
      <h1 className="text-34 leading-heading font-bold tracking-tight-40 md:text-42 md:tracking-tight-45">
        Группы
      </h1>
      <GroupForm action={createGroup} create />
      <Suspense fallback={<Skeleton className="h-64 rounded-28" />}>
        <Groups />
      </Suspense>
    </div>
  );
}

async function Groups() {
  const groups = await listGroups();
  if (groups.length === 0)
    return (
      <p className="text-16 text-muted">
        Групп пока нет. Создайте первую — контакты можно добавить позже.
      </p>
    );
  return (
    <ul className="flex flex-col gap-4">
      {groups.map((group) => (
        <li
          key={group.id}
          className="flex flex-col gap-4 rounded-28 bg-gray p-5 md:p-6"
        >
          <h2 className="text-20 font-semibold break-words">
            <Link
              href={`/groups/${group.id}`}
              className="rounded-12 underline-offset-4 hover:text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent"
            >
              {group.name}
            </Link>
          </h2>
          <GroupForm
            key={group.name}
            action={renameGroup.bind(null, group.id)}
            name={group.name}
          />
          <div>
            <ConfirmDeleteDialog
              title={`Удалить группу «${group.name}»?`}
              description="Группа снимется со всех контактов. Сами контакты, их заметки и остальные группы сохранятся."
              action={deleteGroup.bind(null, group.id)}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
