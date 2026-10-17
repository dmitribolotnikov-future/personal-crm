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

// A gray card like the benefit cards on the landing: date in mono caps, text, actions below
export function NoteItem({ id, body, dateLabel, edited }: NoteItemProps) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="flex flex-col gap-2.5 rounded-28 bg-gray p-6 md:gap-3 md:rounded-32 md:p-8">
      <span className="font-mono text-12 font-medium tracking-wide-60 text-accent-ink uppercase md:text-13">
        {dateLabel}
        {edited && " · изменено"}
      </span>
      {editing ? (
        <NoteEditForm id={id} body={body} onDone={() => setEditing(false)} />
      ) : (
        <>
          <p className="text-16 leading-body text-pretty break-words whitespace-pre-wrap md:text-17">
            {body}
          </p>
          <div className="-ml-3.5 flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil />
              Изменить
            </Button>
            <ConfirmDeleteDialog
              title="Удалить заметку?"
              description="Заметка удалится навсегда, восстановить её будет нельзя."
              action={deleteNote.bind(null, id)}
              triggerVariant="ghost"
              triggerSize="sm"
            />
          </div>
        </>
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
    <form action={formAction} className="flex flex-col gap-3">
      <Textarea
        name="body"
        defaultValue={state.body ?? body}
        rows={4}
        autoFocus
        aria-label="Текст заметки"
        aria-invalid={state.errors ? true : undefined}
        aria-describedby={state.errors ? errorId : undefined}
        className="bg-white"
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
