import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <section className="mx-auto flex w-full max-w-130 flex-col gap-6 rounded-36 bg-powder p-3 md:p-5">
      <Card>
        <h1 className="text-34 leading-heading font-bold tracking-tight-40">
          Вход в Личную CRM
        </h1>
        <LoginForm />
      </Card>
    </section>
  );
}
