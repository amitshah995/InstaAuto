import { POSTS_A } from "./posts-a"
import { POSTS_B } from "./posts-b"
import { POSTS_C } from "./posts-c"
import { POSTS_D } from "./posts-d"
import { POSTS_E } from "./posts-e"
import type { Block, BlogCategory, BlogPost } from "./types"

export type { Block, BlogCategory, BlogPost, Section } from "./types"
export { BLOG_CATEGORIES } from "./types"

/** All posts, newest first. */
export const POSTS: BlogPost[] = [...POSTS_A, ...POSTS_B, ...POSTS_C, ...POSTS_D, ...POSTS_E].sort((a, b) => b.date.localeCompare(a.date))

export const getPost = (slug: string) => POSTS.find((p) => p.slug === slug)

export function relatedPosts(post: BlogPost, n = 3): BlogPost[] {
  const others = POSTS.filter((p) => p.slug !== post.slug)
  const same = others.filter((p) => p.category === post.category)
  return [...same, ...others.filter((p) => p.category !== post.category)].slice(0, n)
}

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

function blockText(b: Block): string {
  switch (b.t) {
    case "p": case "h3": return b.text
    case "ul": case "ol": return b.items.join(" ")
    case "callout": return b.text
    case "dm-example": return b.messages.join(" ")
    case "checklist": return b.items.join(" ")
    case "faq": return b.items.map((i) => `${i.q} ${i.a}`).join(" ")
  }
}

export function postWordCount(p: BlogPost): number {
  const all = [...p.tldr, ...p.sections.flatMap((s) => [s.heading, ...s.blocks.map(blockText)])].join(" ")
  return all.split(/\s+/).filter(Boolean).length
}

export { formatDate } from "./format"
