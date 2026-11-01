"use client";

import { useActionState, useId } from "react";

import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GroupFormState } from "@/lib/form-state";

export function GroupForm({
  action,
  name = "",
  create = false,
}: {
  action: (
    state: GroupFormState,
    formData: FormData,
  ) => Promise<GroupFormState>;
  name?: string;
  create?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const inputId = useId();
  const errorId = `${inputId}-error`;

  return (
    <form action={formAction} className="flex min-w-0 flex-1 flex-col gap-2">
      <Label htmlFor={inputId}>
        {create ? "Название новой группы" : "Название группы"}
      </Label>
      <div className="flex flex-wrap items-start gap-2">
        <Input
          id={inputId}
          name="name"
          defaultValue={state.name ?? (create ? "" : name)}
          autoComplete="off"
          aria-invalid={state.errors ? true : undefined}
          aria-describedby={state.errors ? errorId : undefined}
          className="min-w-0 flex-1"
        />
        <SubmitButton pendingLabel="Сохраняю…">
          {create ? "Создать группу" : "Сохранить"}
        </SubmitButton>
      </div>
      <FieldError id={errorId} errors={state.errors} />
      {state.ok && (
        <p role="status" className="text-14 text-muted">
          {create ? "Группа создана" : "Название сохранено"}
        </p>
      )}
    </form>
  );
}
