"use client";

import Link from "next/link";
import { useActionState, useId, useLayoutEffect, useRef, useState } from "react";

import { FieldError } from "@/components/field-error";
import { ContactGroupCreate } from "@/components/contact-group-create";
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
import { frequencyPhrase, frequencyValues } from "@/lib/keep-in-touch";
import type { GroupSummary } from "@/lib/data";

type ContactFormProps = {
  action: (
    state: ContactFormState,
    formData: FormData,
  ) => Promise<ContactFormState>;
  defaultValues?: ContactValues;
  groups: GroupSummary[];
  groupsSectionId?: string;
  contactId?: number;
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
  groupIds: [],
};

// "раз в месяц" -> "Раз в месяц"
function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("ru") + text.slice(1);
}

// "" is "not set"; it is first and selected by default
const frequencyOptions = [
  { value: "", label: "Не задано" },
  ...frequencyValues.map((value) => ({
    value,
    label: capitalize(frequencyPhrase(value)),
  })),
];

export function ContactForm(props: ContactFormProps) {
  const [formKey, setFormKey] = useState(0);
  const visible = useRef(false);

  // Next.js keeps visited pages mounted in the background. Remount the form when
  // the page is hidden so the next visit starts clean, not with stale input.
  useLayoutEffect(() => {
    visible.current = true;
    return () => {
      visible.current = false;
      // Strict Mode reconnects immediately; an actual hidden page stays disconnected.
      queueMicrotask(() => {
        if (!visible.current) setFormKey((key) => key + 1);
      });
    };
  }, []);

  return <ContactFormFields key={formKey} {...props} />;
}

function ContactFormFields({
  action,
  defaultValues = emptyValues,
  submitLabel,
  cancelHref,
  groups,
  groupsSectionId,
  contactId,
}: ContactFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [selectedGroupIds, setSelectedGroupIds] = useState(defaultValues.groupIds);
  const [createdGroups, setCreatedGroups] = useState<GroupSummary[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const availableGroups = [
    ...groups,
    ...createdGroups.filter((created) => !groups.some((group) => group.id === created.id)),
  ];
  const values = state.values ?? defaultValues;
  const formId = useId();
  const groupsRef = useRef<HTMLFieldSetElement>(null);
  useLayoutEffect(() => {
    const scrollToGroups = () => {
      if (groupsSectionId && window.location.hash === `#${groupsSectionId}`) {
        groupsRef.current?.scrollIntoView({ block: "start" });
      }
    };
    scrollToGroups();
    window.addEventListener("hashchange", scrollToGroups);
    return () => window.removeEventListener("hashchange", scrollToGroups);
  }, [groupsSectionId]);
  const fieldId = (field: ContactField | "groupIds") => `${formId}-${field}`;
  const errorId = (field: ContactField | "groupIds") => `${fieldId(field)}-error`;

  const fieldProps = (field: ContactField) => ({
    id: fieldId(field),
    name: field,
    defaultValue: values[field],
    "aria-invalid": state.errors?.[field] ? true : undefined,
    "aria-describedby": state.errors?.[field] ? errorId(field) : undefined,
  });

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId("name")}>Имя</Label>
        <Input {...fieldProps("name")} required autoComplete="off" />
        <FieldError id={errorId("name")} errors={state.errors?.name} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId("about")}>Кто это</Label>
        <Input
          {...fieldProps("about")}
          placeholder="Например: бывший коллега, дизайнер"
          autoComplete="off"
        />
        <FieldError id={errorId("about")} errors={state.errors?.about} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId("howWeMet")}>Откуда знакомы</Label>
        <Textarea
          {...fieldProps("howWeMet")}
          rows={2}
          placeholder="Например: познакомились на конференции в 2024"
        />
        <FieldError id={errorId("howWeMet")} errors={state.errors?.howWeMet} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId("phone")}>Телефон</Label>
          <Input {...fieldProps("phone")} type="tel" autoComplete="off" />
          <FieldError id={errorId("phone")} errors={state.errors?.phone} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId("email")}>Почта</Label>
          <Input {...fieldProps("email")} type="email" autoComplete="off" />
          <FieldError id={errorId("email")} errors={state.errors?.email} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId("workplace")}>Место работы</Label>
        <Input
          {...fieldProps("workplace")}
          placeholder="Например: Яндекс, отдел маркетинга"
          autoComplete="off"
        />
        <FieldError id={errorId("workplace")} errors={state.errors?.workplace} />
      </div>

      {/* Real radio inputs, visually hidden: they work with FormData and the keyboard */}
      <fieldset
        className="min-w-0"
        aria-describedby={
          state.errors?.contactFrequency ? errorId("contactFrequency") : undefined
        }
      >
        <legend className="mb-2 text-14 leading-none font-semibold text-ink-soft">
          Как часто общаться
        </legend>
        <div className="flex flex-wrap gap-2">
          {frequencyOptions.map((option) => (
            <label key={option.value} className="cursor-pointer">
              <input
                type="radio"
                name="contactFrequency"
                value={option.value}
                defaultChecked={values.contactFrequency === option.value}
                className="peer sr-only"
              />
              <span className="inline-flex h-11 items-center rounded-pill bg-gray px-5 text-15 font-semibold text-ink transition-colors select-none hover:bg-avatar-gray peer-checked:bg-ink peer-checked:text-white peer-checked:hover:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-accent">
                {option.label}
              </span>
            </label>
          ))}
        </div>
        <FieldError
          id={errorId("contactFrequency")}
          errors={state.errors?.contactFrequency}
        />
      </fieldset>

      <fieldset id={groupsSectionId} ref={groupsRef} className="min-w-0 scroll-mt-6" aria-describedby={state.errors?.groupIds ? errorId("groupIds") : undefined}>
        <legend className="mb-2 text-14 leading-none font-semibold text-ink-soft">Группы</legend>
        {availableGroups.length === 0 && (
          <p className="text-15 text-muted">
            {contactId === undefined ? <>Групп пока нет. Создайте их на странице <Link href="/groups" className="underline underline-offset-4">«Группы»</Link>.</> : "Групп пока нет. Нажмите «+», чтобы создать первую."}
          </p>
        )}
          <div className="flex flex-wrap gap-2">
            {availableGroups.map((group) => (
              <label key={group.id} className="max-w-full cursor-pointer">
                <input
                  type="checkbox" name="groupIds" value={group.id}
                  checked={selectedGroupIds.includes(String(group.id))}
                  onChange={(event) => {
                    const id = String(group.id);
                    const checked = event.target.checked;
                    setSelectedGroupIds((current) => checked ? [...current, id] : current.filter((value) => value !== id));
                  }}
                  aria-invalid={state.errors?.groupIds ? true : undefined}
                  aria-describedby={state.errors?.groupIds ? errorId("groupIds") : undefined}
                  className="peer sr-only"
                />
                <span className="inline-flex min-h-11 max-w-full items-center rounded-pill bg-gray px-5 py-2 text-15 font-semibold break-words text-ink transition-colors select-none hover:bg-avatar-gray peer-checked:bg-ink peer-checked:text-white peer-checked:hover:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-accent">
                  {group.name}
                </span>
              </label>
            ))}
            {contactId !== undefined && (
              <ContactGroupCreate
                contactId={contactId}
                onPendingChange={setCreatingGroup}
                onCreated={(group) => {
                  setCreatedGroups((current) => [...current.filter((value) => value.id !== group.id), group]);
                  setSelectedGroupIds((current) => [...new Set([...current, String(group.id)])]);
                }}
              />
            )}
          </div>
        <FieldError id={errorId("groupIds")} errors={state.errors?.groupIds} />
      </fieldset>

      {state.message && (
        <p className="text-14 text-danger" role="alert">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <SubmitButton size="lg" pendingLabel="Сохраняю…" disabled={pending || creatingGroup}>
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
