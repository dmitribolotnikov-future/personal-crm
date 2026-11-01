// Shapes of the results that server actions return to forms

export const contactFields = [
  "name",
  "about",
  "howWeMet",
  "phone",
  "email",
  "workplace",
  // A ContactFrequency value, or "" for "not set"
  "contactFrequency",
] as const;

export type ContactField = (typeof contactFields)[number];
export type ContactValues = Record<ContactField, string> & { groupIds: string[] };

export function readContactValues(formData: FormData): ContactValues {
  return {
    ...Object.fromEntries(
      contactFields.map((field) => [field, String(formData.get(field) ?? "")]),
    ) as Record<ContactField, string>,
    groupIds: formData.getAll("groupIds").map((value) => typeof value === "string" ? value : ""),
  };
}

export type ContactFormState = {
  // Submitted values, returned on error so the form keeps what the user typed
  values?: ContactValues;
  errors?: Partial<Record<ContactField | "groupIds", string[]>>;
  message?: string;
};

export type NoteFormState = {
  body?: string;
  errors?: string[];
  ok?: boolean;
};

export type GroupFormState = {
  name?: string;
  errors?: string[];
  ok?: boolean;
  groupId?: number;
};
