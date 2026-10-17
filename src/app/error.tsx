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
    <div className="flex flex-col items-start gap-4 md:gap-5">
      <h1 className="text-34 leading-heading font-bold tracking-tight-40 text-balance md:text-42 md:tracking-tight-45">
        Что-то пошло не так
      </h1>
      <p className="max-w-130 text-17 leading-lead text-pretty text-ink-soft">
        Не получилось загрузить или сохранить данные. Проверьте, что база данных
        запущена, и попробуйте ещё раз.
      </p>
      <Button onClick={() => retry()}>Попробовать ещё раз</Button>
    </div>
  );
}
