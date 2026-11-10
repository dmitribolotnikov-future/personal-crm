"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailSchema } from "@/lib/email";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError("Проверь адрес почты");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/sign-in/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: parsed.data }),
      });
      if (response.status === 400) setError("Проверь адрес почты");
      else if (response.status === 429)
        setMessage("Слишком часто, попробуй через несколько минут");
      else setMessage(`Ссылка для входа отправлена на ${parsed.data}`);
    } catch {
      setMessage(`Ссылка для входа отправлена на ${parsed.data}`);
    } finally {
      setPending(false);
    }
  }
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="login-email">Почта</Label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "email-error" : undefined}
        />
        {error && (
          <p id="email-error" role="alert" className="text-14 text-danger">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Отправляем…" : "Получить ссылку"}
      </Button>
      {message && (
        <p role="status" className="text-16 break-words text-ink-soft">
          {message}
        </p>
      )}
    </form>
  );
}
