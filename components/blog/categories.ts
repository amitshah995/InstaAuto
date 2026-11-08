import type { BlogCategory } from "@/lib/blog/types"

/** Short chip description, shown as a tooltip title and on the index. */
export const CATEGORY_BLURB: Record<BlogCategory, string> = {
  Guides: "Step-by-step help",
  Templates: "Messages to copy",
  Growth: "Reading and improving results",
  Product: "How Celra works",
  Safety: "Rules and good habits",
}
