import { createContact } from "@/app/actions";
import { ContactForm } from "@/components/contact-form";

export default function NewContactPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold">Новый контакт</h1>
      <ContactForm action={createContact} submitLabel="Добавить" cancelHref="/" />
    </div>
  );
}
