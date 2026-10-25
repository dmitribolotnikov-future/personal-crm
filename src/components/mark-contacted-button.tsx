import { Check } from "lucide-react";

import { markContacted } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

// Adds a "Связались" note right away, with no confirmation. The button disables itself
// while saving, so a quick double click does not create two notes.
export function MarkContactedButton({ contactId }: { contactId: number }) {
  return (
    <form action={markContacted.bind(null, contactId)}>
      <SubmitButton variant="secondary" pendingLabel="Сохраняю…">
        <Check />
        Связались
      </SubmitButton>
    </form>
  );
}
