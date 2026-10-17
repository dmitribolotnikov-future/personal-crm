import { cn } from "@/lib/utils";

// Same logo as on the landing: "лично" with an accent dot
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("font-extrabold tracking-tight-30", className)}>
      лично<span className="text-accent">.</span>
    </span>
  );
}
