"use client";

import { Trash2 } from "lucide-react";

import { SubmitButton } from "@/components/submit-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ConfirmDeleteDialogProps = {
  title: string;
  description: string;
  action: () => Promise<void>;
  triggerSize?: React.ComponentProps<typeof Button>["size"];
};

export function ConfirmDeleteDialog({
  title,
  description,
  action,
  triggerSize = "default",
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="destructive" size={triggerSize} />}
      >
        <Trash2 />
        Удалить
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <form action={action} className="flex flex-col">
            <SubmitButton variant="destructive" pendingLabel="Удаляю…">
              Удалить
            </SubmitButton>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
