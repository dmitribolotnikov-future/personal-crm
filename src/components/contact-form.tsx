"use client";

import Link from "next/link";
import { useActionState, useLayoutEffect, useState } from "react";

import { FieldError } from "@/components/field-error";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  ContactField,
  ContactFormState,
  ContactValues,
} from "@/lib/form-state";

type ContactFormProps = {
  action: (
    state: ContactFormState,
    formData: FormData,
  ) => Promise<ContactFormState>;
  defaultValues?: ContactValues;
  submitLabel: string;
  cancelHref: string;
};

const emptyValues: ContactValues = {
  name: "",
  about: "",
  howWeMet: "",
  phone: "",
  email: "",
  workplace: "",
  contactFrequency: "",
};

export function ContactForm(props: ContactFormProps) {
  const [formKey, setFormKey] = useState(0);

  // Next.js keeps visited pages mounted in the background. Remount the form when
  // the page is hidden so the next visit starts clean, not with stale input.
  useLayoutEffect(() => () => setFormKey((key) => key + 1), []);

  return <ContactFormFields key={formKey} {...props} />;
}

function ContactFormFields({
  action,
  defaultValues = emptyValues,
  submitLabel,
  cancelHref,
}: ContactFormProps) {
  const [state, formAction] = useActionState(action, {});
  const values = state.values ?? defaultValues;

  const fieldProps = (field: ContactField) => ({
    id: field,
    name: field,
    defaultValue: values[field],
    "aria-invalid": state.errors?.[field] ? true : undefined,
    "aria-describedby": state.errors?.[field] ? `${field}-error` : undefined,
  });

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Имя</Label>
        <Input {...fieldProps("name")} required autoComplete="off" />
        <FieldError id="name-error" errors={state.errors?.name} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="about">Кто это</Label>
        <Input
          {...fieldProps("about")}
          placeholder="Например: бывший коллега, дизайнер"
          autoComplete="off"
        />
        <FieldError id="about-error" errors={state.errors?.about} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="howWeMet">Откуда знакомы</Label>
        <Textarea
          {...fieldProps("howWeMet")}
          rows={2}
          placeholder="Например: познакомились на конференции в 2024"
        />
        <FieldError id="howWeMet-error" errors={state.errors?.howWeMet} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Телефон</Label>
          <Input {...fieldProps("phone")} type="tel" autoComplete="off" />
          <FieldError id="phone-error" errors={state.errors?.phone} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Почта</Label>
          <Input {...fieldProps("email")} type="email" autoComplete="off" />
          <FieldError id="email-error" errors={state.errors?.email} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="workplace">Место работы</Label>
        <Input
          {...fieldProps("workplace")}
          placeholder="Например: Яндекс, отдел маркетинга"
          autoComplete="off"
        />
        <FieldError id="workplace-error" errors={state.errors?.workplace} />
      </div>

      {state.message && (
        <p className="text-14 text-danger" role="alert">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <SubmitButton size="lg" pendingLabel="Сохраняю…">
          {submitLabel}
        </SubmitButton>
        <Link
          href={cancelHref}
          className={buttonVariants({ variant: "ghost", size: "lg" })}
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}
