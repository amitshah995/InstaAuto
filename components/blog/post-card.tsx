import Link from "next/link"
import { Clock } from "lucide-react"
import { formatDate } from "@/lib/blog/format"
import type { PostSummary } from "@/lib/blog/summary"
import { PostCover } from "./cover"

export function CategoryTag({ children }: { children: string }) {
  return <span className="inline-flex self-start rounded-full bg-c-brand-soft px-2.5 py-0.5 text-xs font-semibold text-c-brand">{children}</span>
}

/** Whole card is clickable through the stretched title link. */
export function PostCard({ post }: { post: PostSummary }) {
  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-xl border border-c-line bg-c-surface transition-colors hover:border-c-brand has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-c-brand">
      <div className="aspect-[16/10] overflow-hidden border-b border-c-line">
        <PostCover category={post.category} slug={post.slug} className="transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <CategoryTag>{post.category}</CategoryTag>
        <h3 className="mt-3 font-display text-xl font-semibold leading-snug tracking-tight">
          <Link href={`/blog/${post.slug}`} className="rounded after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">{post.title}</Link>
        </h3>
        <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-c-muted">{post.excerpt}</p>
        <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-xs text-c-muted">
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{post.readMinutes} min read</span>
        </p>
      </div>
    </article>
  )
}
