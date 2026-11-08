export type BlogCategory = "Guides" | "Templates" | "Growth" | "Product" | "Safety"

export const BLOG_CATEGORIES: BlogCategory[] = ["Guides", "Templates", "Growth", "Product", "Safety"]

export type Block =
  | { t: "p"; text: string }
  | { t: "h3"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "callout"; kind: "tip" | "warn"; text: string; title?: string }
  | { t: "dm-example"; comment: string; messages: string[]; caption?: string; handle?: string }
  | { t: "checklist"; title: string; items: string[] }
  | { t: "faq"; items: { q: string; a: string }[] }

export type Section = { heading: string; blocks: Block[] }

export type BlogPost = {
  slug: string
  title: string
  excerpt: string
  category: BlogCategory
  /** ISO date, YYYY-MM-DD */
  date: string
  readMinutes: number
  featured?: boolean
  tldr: string[]
  sections: Section[]
}
