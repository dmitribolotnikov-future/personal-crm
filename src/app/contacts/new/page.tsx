import { createContact } from "@/app/actions";
import { ContactForm } from "@/components/contact-form";

export default function NewContactPage() {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <h1 className="text-34 leading-heading font-bold tracking-tight-40 md:text-42 md:tracking-tight-45">
        Новый контакт
      </h1>
      <ContactForm action={createContact} submitLabel="Добавить" cancelHref="/" />
    </div>
  );
}
