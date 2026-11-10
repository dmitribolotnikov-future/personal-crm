"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AccountMenu({ email }: { email: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function signOut() {
    setPending(true);
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (response.ok) {
        router.replace("/login");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="min-w-0 text-14 break-all text-muted-2">{email}</span>
      <Button variant="ghost" size="sm" disabled={pending} onClick={signOut}>
        Выйти
      </Button>
    </div>
  );
}
