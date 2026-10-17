import { createCn } from "cn/config"

const isNumber = (value: string) => /^\d+$/.test(value)

// cn has to know the token names from tokens.css: otherwise it takes "text-14" for a color
// and drops it next to "text-ink", or takes "shadow-card" for a shadow color
export const cn = createCn({
  extend: {
    theme: {
      text: [isNumber],
      leading: ["display", "heading", "title", "snug", "lead", "body"],
      tracking: [(value: string) => /^(tight|wide)-\d+$/.test(value)],
      radius: ["circle", "pill", isNumber],
      shadow: ["card", "card-lg", "pill"],
    },
  },
})
