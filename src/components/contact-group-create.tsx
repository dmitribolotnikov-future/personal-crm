"use client";

import { Plus } from "lucide-react";
import { startTransition, useActionState, useId, useLayoutEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createContactGroup } from "@/app/actions";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GroupFormState } from "@/lib/form-state";
import type { GroupSummary } from "@/lib/data";

type ContactGroupCreateProps = {
  contactId: number;
  onCreated?: (group: GroupSummary) => void;
  onPendingChange?: (pending: boolean) => void;
};

export function ContactGroupCreate({ contactId, onCreated, onPendingChange }: ContactGroupCreateProps) {
  const [open, setOpen] = useState(false);
  const { pending: contactSaving } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const close = () => {
    restoreFocus.current = true;
    setOpen(false);
  };
  useLayoutEffect(() => {
    if (!open && restoreFocus.current) {
      buttonRef.current?.focus();
      restoreFocus.current = false;
    }
  }, [open]);
  if (open) {
    return (
      <CreateGroupFields
        contactId={contactId}
        onClose={close}
        onCreated={onCreated}
        onPendingChange={onPendingChange}
        disabled={contactSaving}
      />
    );
  }
  return (
    <Button
      ref={buttonRef}
      type="button"
      variant="secondary"
      className="size-11 p-0"
      aria-label="Создать новую группу"
      title="Создать новую группу"
      disabled={contactSaving}
      onClick={() => setOpen(true)}
    >
      <Plus aria-hidden="true" />
    </Button>
  );
}

function CreateGroupFields({ contactId, onClose, onCreated, onPendingChange, disabled }: ContactGroupCreateProps & {
  onClose: () => void;
  disabled: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const wasPending = useRef(false);
  const errorId = `${inputId}-error`;
  const [state, formAction, pending] = useActionState(
    async (previous: GroupFormState, formData: FormData) => {
      try {
        const result = await createContactGroup(contactId, previous, formData);
        if (result.ok && result.groupId !== undefined) {
          onCreated?.({ id: result.groupId, name: String(formData.get("name") ?? "").trim() });
          onClose();
        }
        return result;
      } finally {
        onPendingChange?.(false);
      }
    },
    {},
  );
  useLayoutEffect(() => {
    if (wasPending.current && !pending && !disabled) inputRef.current?.focus();
    wasPending.current = pending;
  }, [pending, disabled]);
  const submit = () => {
    if (pending || disabled) return;
    const formData = new FormData();
    formData.set("name", inputRef.current?.value ?? "");
    onPendingChange?.(true);
    startTransition(() => formAction(formData));
  };

  return (
    <div
      role="group"
      aria-label="Создание новой группы"
      className="flex w-full flex-col gap-2"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending && !disabled) {
          event.preventDefault();
          onClose();
        } else if (event.key === "Enter" && event.target === inputRef.current) {
          event.preventDefault();
          event.stopPropagation();
          submit();
        }
      }}
    >
      <Label htmlFor={inputId} className="sr-only">Название новой группы</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          ref={inputRef}
          id={inputId}
          defaultValue={state.name ?? ""}
          placeholder="Название группы"
          autoComplete="off"
          autoFocus
          disabled={pending || disabled}
          aria-invalid={state.errors ? true : undefined}
          aria-describedby={state.errors ? errorId : undefined}
          className="h-11 w-full sm:w-64"
        />
        <Button type="button" disabled={pending || disabled} onClick={submit}>
          {pending ? "Создаю…" : "Создать"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending || disabled} onClick={onClose}>
          Отмена
        </Button>
      </div>
      <FieldError id={errorId} errors={state.errors} />
    </div>
  );
}
