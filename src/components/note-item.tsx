"use client";

import { Pencil } from "lucide-react";
import { useActionState, useState } from "react";

import { deleteNote, updateNote } from "@/app/actions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { NoteFormState } from "@/lib/form-state";

type NoteItemProps = {
  id: number;
  body: string;
  // Formatted on the server so the date does not depend on the browser's timezone
  dateLabel: string;
  edited: boolean;
};

export function NoteItem({ id, body, dateLabel, edited }: NoteItemProps) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="flex flex-col gap-2 rounded-xl p-4 ring-1 ring-foreground/10">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {dateLabel}
          {edited && " · изменено"}
        </span>
        {!editing && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil />
              Изменить
            </Button>
            <ConfirmDeleteDialog
              title="Удалить заметку?"
              description="Заметка удалится навсегда, восстановить её будет нельзя."
              action={deleteNote.bind(null, id)}
              triggerSize="sm"
            />
          </div>
        )}
      </div>
      {editing ? (
        <NoteEditForm id={id} body={body} onDone={() => setEditing(false)} />
      ) : (
        <p className="text-sm whitespace-pre-wrap">{body}</p>
      )}
    </li>
  );
}

function NoteEditForm({
  id,
  body,
  onDone,
}: {
  id: number;
  body: string;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(
    async (prevState: NoteFormState, formData: FormData) => {
      const result = await updateNote(id, prevState, formData);
      if (result.ok) onDone();
      return result;
    },
    {},
  );

  const errorId = `note-${id}-error`;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Textarea
        name="body"
        defaultValue={state.body ?? body}
        rows={4}
        autoFocus
        aria-label="Текст заметки"
        aria-invalid={state.errors ? true : undefined}
        aria-describedby={state.errors ? errorId : undefined}
      />
      <FieldError id={errorId} errors={state.errors} />
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingLabel="Сохраняю…">
          Сохранить
        </SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
