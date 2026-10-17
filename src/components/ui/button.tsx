import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Pill buttons as on the landing: dark by default, hover lowers opacity
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-pill font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-ink text-white hover:opacity-88",
        secondary: "bg-gray text-ink hover:bg-avatar-gray",
        // A translucent hover works on any light surface: page, gray or white card
        ghost: "text-ink-soft hover:bg-ink/6 hover:text-ink",
        destructive: "bg-danger/10 text-danger hover:bg-danger/15",
      },
      size: {
        default: "h-11 gap-2 px-5 text-15 [&_svg:not([class*='size-'])]:size-4.5",
        sm: "h-9 gap-1.5 px-3.5 text-14 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-13 gap-2.5 px-6 text-16 md:h-14 md:px-7 md:text-17 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
