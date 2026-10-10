"use client";

import { useActionState } from "react";

import { addNote } from "@/app/actions";
import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { Textarea } from "@/components/ui/textarea";
import type { NoteFormState } from "@/lib/form-state";

export function NoteForm({ contactId }: { contactId: number }) {
  const [state, formAction] = useActionState(
    (prevState: NoteFormState, formData: FormData) =>
      addNote(contactId, prevState, formData),
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Textarea
        name="body"
        // After a successful save state.body is empty, so the field clears
        defaultValue={state.body ?? ""}
        rows={3}
        placeholder="О чём поговорили, о чём договорились"
        aria-label="Новая заметка"
        aria-invalid={state.errors ? true : undefined}
        aria-describedby={state.errors ? "new-note-error" : undefined}
      />
      <FieldError id="new-note-error" errors={state.errors} />
      <div>
        <SubmitButton pendingLabel="Сохраняю…">Добавить заметку</SubmitButton>
      </div>
    </form>
  );
}
