"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Clock, Mail, Search, X } from "lucide-react"
import { BLOG_CATEGORIES, type BlogCategory } from "@/lib/blog/types"
import type { PostSummary } from "@/lib/blog/summary"
import { formatDate } from "@/lib/blog/format"
import { BRAND_NAME } from "@/lib/site"
import { PromoButton } from "@/components/marketing/promo-popup"
import { btnOutline, btnPrimary, container, focusRing, SampleTag } from "@/components/marketing/ui"
import { CATEGORY_BLURB } from "./categories"
import { PostCover } from "./cover"
import { CategoryTag, PostCard } from "./post-card"

const PAGE_SIZE = 9
type Filter = "All" | BlogCategory

const chip = (on: boolean) =>
  `inline-flex min-h-10 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors ${focusRing} ${
    on ? "border-c-ink bg-c-ink text-c-bg" : "border-c-line bg-c-surface text-c-ink hover:border-c-brand"
  }`

export function BlogIndex({ posts }: { posts: PostSummary[] }) {
  const [query, setQuery] = useState("")
  const [cat, setCat] = useState<Filter>("All")
  const [shown, setShown] = useState(PAGE_SIZE)

  const featured = posts.find((p) => p.featured) ?? posts[0]
  const q = query.trim().toLowerCase()
  const browsing = cat === "All" && !q
  const list = useMemo(
    () => posts.filter((p) => {
      if (browsing && p.slug === featured.slug) return false
      if (cat !== "All" && p.category !== cat) return false
      return !q || `${p.title} ${p.excerpt} ${p.category}`.toLowerCase().includes(q)
    }),
    [posts, cat, q, browsing, featured.slug],
  )
  const visible = list.slice(0, shown)

  return (
    <>
      {/* Hero */}
      <section className="border-b border-c-line bg-c-cream" aria-labelledby="blog-h">
        <div className={`${container} grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]`}>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-c-brand">The {BRAND_NAME} blog</p>
            <h1 id="blog-h" className="mt-3 font-display text-[2.25rem] font-semibold leading-[1.08] tracking-tight sm:text-5xl">Notes on turning comments into conversations</h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-c-muted">Plain-English guides, message templates and safety habits for anyone who answers the same questions under their reels.</p>
            <form role="search" onSubmit={(e) => e.preventDefault()} className="mt-7 max-w-xl">
              <label htmlFor="blog-search" className="sr-only">Search articles</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-c-muted" aria-hidden />
                <input
                  id="blog-search"
                  type="search"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setShown(PAGE_SIZE) }}
                  placeholder="Search keywords, templates, safety..."
                  autoComplete="off"
                  className={`h-12 w-full rounded-[5px] border-2 border-c-ink bg-c-surface pl-11 pr-11 text-base text-c-ink placeholder:text-c-muted ${focusRing}`}
                />
                {query && (
                  <button type="button" onClick={() => { setQuery(""); setShown(PAGE_SIZE) }} aria-label="Clear search" className={`absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-c-muted hover:bg-c-soft ${focusRing}`}>
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>
            </form>
          </div>
          <HeroDrawing />
        </div>
      </section>

      <div className={`${container} pt-8`}>
        {/* Category chips */}
        <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
          {(["All", ...BLOG_CATEGORIES] as Filter[]).map((c) => (
            <button key={c} type="button" aria-pressed={cat === c} title={c === "All" ? "Every article" : CATEGORY_BLURB[c]} onClick={() => { setCat(c); setShown(PAGE_SIZE) }} className={chip(cat === c)}>{c}</button>
          ))}
        </div>

        {/* Featured */}
        {browsing && featured && (
          <article className="group relative mt-8 grid overflow-hidden rounded-2xl border border-c-line bg-c-surface transition-colors hover:border-c-brand has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-c-brand md:grid-cols-2">
            <div className="aspect-[16/10] overflow-hidden border-b border-c-line md:aspect-auto md:min-h-[340px] md:border-b-0 md:border-r">
              <PostCover category={featured.category} slug={featured.slug} className="transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-10">
              <div className="flex items-center gap-3"><CategoryTag>{featured.category}</CategoryTag><span className="rounded-full bg-c-accent px-2.5 py-0.5 text-xs font-semibold text-c-accent-ink">Featured</span></div>
              <h2 className="mt-4 font-display text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-4xl">
                <Link href={`/blog/${featured.slug}`} className="rounded after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">{featured.title}</Link>
              </h2>
              <p className="mt-3 text-base leading-relaxed text-c-muted sm:text-lg">{featured.excerpt}</p>
              <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-c-muted">
                <time dateTime={featured.date}>{formatDate(featured.date)}</time><span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden />{featured.readMinutes} min read</span>
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-c-brand" aria-hidden>Read the article <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" /></span>
            </div>
          </article>
        )}

        {/* Promo row */}
        <div className="mt-8 grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <aside aria-label="Free Instagram audit" className="flex flex-col justify-between gap-5 rounded-xl bg-c-brand p-6 text-c-bg sm:flex-row sm:items-center sm:p-8">
            <div>
              <h2 className="font-display text-2xl font-semibold leading-tight">Free Instagram audit</h2>
              <p className="mt-2 max-w-md text-[15px] leading-relaxed opacity-90">Connect a Business or Creator account and see what to fix first: bio, posting rhythm, engagement and lead capture.</p>
            </div>
            <Link href="/instagram-audit" className={`${btnPrimary} shrink-0`}>Run the audit <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </aside>
          <aside aria-label="Flow templates" className="flex flex-col justify-between gap-4 rounded-xl border border-c-line bg-c-surface p-6 sm:p-8">
            <div>
              <h2 className="font-display text-xl font-semibold leading-tight">Skip the blank page</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-c-muted">Ready-made DM flows for links, prices and bookings.</p>
            </div>
            <Link href="/flow-templates" className={`inline-flex items-center gap-1.5 self-start rounded text-[15px] font-semibold text-c-brand hover:underline ${focusRing}`}>Browse templates <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </aside>
        </div>

        {/* Grid */}
        <section className="mt-12" aria-labelledby="all-h">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="all-h" className="font-display text-2xl font-semibold tracking-tight">{browsing ? "More articles" : cat === "All" ? "Search results" : cat}</h2>
            <p className="text-sm text-c-muted" role="status" aria-live="polite">{list.length} {list.length === 1 ? "article" : "articles"}</p>
          </div>
          {list.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-c-line bg-c-surface p-10 text-center">
              <p className="font-display text-lg font-semibold">Nothing matches that yet</p>
              <p className="mt-1 text-[15px] text-c-muted">Try a shorter word, or clear the filters.</p>
              <button type="button" onClick={() => { setQuery(""); setCat("All") }} className={`${btnOutline} mt-5`}>Clear filters</button>
            </div>
          ) : (
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((p) => <li key={p.slug} className="flex"><PostCard post={p} /></li>)}
            </ul>
          )}
          {visible.length < list.length && (
            <div className="mt-8 flex flex-col items-center gap-2">
              <button type="button" onClick={() => setShown((n) => n + PAGE_SIZE)} className={btnOutline}>Load more articles</button>
              <p className="text-xs text-c-muted">Showing {visible.length} of {list.length}</p>
            </div>
          )}
        </section>

        {/* Early access */}
        <section aria-labelledby="news-h" className="mt-16 grid items-center gap-6 rounded-2xl border border-c-line bg-c-cream p-6 sm:p-10 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-c-brand-soft text-c-brand" aria-hidden><Mail className="h-6 w-6" /></span>
            <h2 id="news-h" className="mt-4 font-display text-2xl font-semibold leading-tight sm:text-3xl">Get early access to {BRAND_NAME}</h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-c-muted">New articles arrive when we have something useful to say, not on a timer. Join early access to try the tool these guides are written for.</p>
          </div>
          <PromoButton className={`${btnPrimary} !min-h-12 !px-7`}>Join early access <ArrowRight className="h-4 w-4" aria-hidden /></PromoButton>
        </section>
      </div>
    </>
  )
}

/** Drawn comment -> private reply sketch. Sample text only. */
function HeroDrawing() {
  return (
    <div className="relative mx-auto hidden w-full max-w-md lg:block" aria-hidden>
      <div className="rounded-2xl border border-c-line bg-c-surface p-5 shadow-[0_1px_0_var(--c-line)]">
        <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-c-muted">Under your reel</p><SampleTag /></div>
        <p className="mt-3 flex items-start gap-2 text-sm"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-c-soft text-[11px] font-semibold">M</span><span className="rounded-2xl rounded-tl-sm bg-c-soft px-3 py-2"><b>maya_k</b> PRICE</span></p>
        <div className="my-4 flex items-center gap-3 text-xs font-medium text-c-muted"><span className="h-px flex-1 bg-c-line" />private reply<span className="h-px flex-1 bg-c-line" /></div>
        <div className="space-y-2 text-sm">
          <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-c-brand px-3 py-2 text-c-bg">Hi Maya! Here is the price list.</p>
          <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-c-brand px-3 py-2 text-c-bg">Which one are you looking at?</p>
        </div>
      </div>
      <span className="absolute -right-3 -top-3 h-8 w-8 rounded-full bg-c-accent" />
    </div>
  )
}
