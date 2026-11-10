import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/auth";

async function SessionGate({ children }: { children: ReactNode }) {
  await requireUser();
  return children;
}

export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SessionGate>{children}</SessionGate>
    </Suspense>
  );
}
