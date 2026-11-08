import type { BlogCategory, BlogPost } from "./types"

/** What the index and the cards need. Keeps article bodies out of the client bundle. */
export type PostSummary = Pick<BlogPost, "slug" | "title" | "excerpt" | "category" | "date" | "readMinutes" | "featured">

export const toSummary = (p: BlogPost): PostSummary => ({
  slug: p.slug, title: p.title, excerpt: p.excerpt, category: p.category as BlogCategory, date: p.date, readMinutes: p.readMinutes, featured: p.featured,
})
