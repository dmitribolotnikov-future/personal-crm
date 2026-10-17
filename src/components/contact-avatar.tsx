import { cn } from "@/lib/utils";

// First letters of the first two words: "Саша Ковалёва" -> "СК"
function initials(name: string): string {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("ru");
}

export function ContactAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-circle bg-ink font-bold text-white",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
