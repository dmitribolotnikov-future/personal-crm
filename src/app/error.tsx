"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="font-heading text-2xl font-semibold">Что-то пошло не так</h1>
      <p className="text-muted-foreground">
        Не получилось загрузить или сохранить данные. Проверьте, что база данных
        запущена, и попробуйте ещё раз.
      </p>
      <Button onClick={() => retry()}>Попробовать ещё раз</Button>
    </div>
  );
}
