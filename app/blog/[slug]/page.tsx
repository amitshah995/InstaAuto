import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, Clock } from "lucide-react"
import { PageShell } from "@/components/marketing/page-shell"
import { CtaCard } from "@/components/marketing/sections/cta-card"
import { container } from "@/components/marketing/ui"
import { BlockView } from "@/components/blog/blocks"
import { MidCta } from "@/components/blog/cta-banner"
import { PostCover } from "@/components/blog/cover"
import { CategoryTag, PostCard } from "@/components/blog/post-card"
import { ReadingProgress } from "@/components/blog/reading-progress"
import { ShareRow } from "@/components/blog/share-row"
import { Toc, type TocItem } from "@/components/blog/toc"
import { POSTS, formatDate, getPost, relatedPosts, slugify } from "@/lib/blog/posts"
import { toSummary } from "@/lib/blog/summary"
import { BRAND_NAME, getSiteUrl } from "@/lib/site"

export const dynamicParams = false
export const generateStaticParams = () => POSTS.map((p) => ({ slug: p.slug }))

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return {}
  const url = `${getSiteUrl()}/blog/${post.slug}`
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: { type: "article", title: `${post.title} | ${BRAND_NAME}`, description: post.excerpt, url, publishedTime: `${post.date}T09:00:00Z`, authors: [`${BRAND_NAME} team`], section: post.category },
    twitter: { card: "summary_large_image", title: post.title, description: post.excerpt },
  }
}

const jsonLd = (o: unknown) => ({ __html: JSON.stringify(o).replace(/</g, "\\u003c") })

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const base = getSiteUrl()
  const url = `${base}/blog/${post.slug}`

  // Unique ids for every h2 / h3, shared by the body and the outline.
  const used = new Set<string>()
  const uid = (text: string) => {
    let id = slugify(text) || "section", n = 2
    while (used.has(id)) id = `${slugify(text)}-${n++}`
    used.add(id)
    return id
  }
  const toc: TocItem[] = []
  const sections = post.sections.map((s) => {
    const id = uid(s.heading)
    toc.push({ id, text: s.heading, level: 2 })
    const blocks = s.blocks.map((b) => {
      if (b.t !== "h3") return { b, id: undefined }
      const hid = uid(b.text)
      toc.push({ id: hid, text: b.text, level: 3 })
      return { b, id: hid }
    })
    return { s, id, blocks }
  })
  const midAfter = Math.ceil(sections.length / 2) - 1

  const faqs = post.sections.flatMap((s) => s.blocks).filter((b) => b.t === "faq").flatMap((b) => (b.t === "faq" ? b.items : []))
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: `${post.date}T09:00:00Z`,
    dateModified: `${post.date}T09:00:00Z`,
    articleSection: post.category,
    image: `${base}/opengraph-image.png`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Organization", name: `${BRAND_NAME} team`, url: base },
    publisher: { "@type": "Organization", name: BRAND_NAME, url: base },
  }
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${base}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: url },
    ],
  }
  const faqLd = faqs.length
    ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }
    : null

  return (
    <PageShell>
      <ReadingProgress targetId="post-body" />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(article)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(crumbs)} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqLd)} />}

      <header className="border-b border-c-line bg-c-cream">
        <div className={`${container} py-8 sm:py-12`}>
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-c-muted">
              <li><Link href="/" className="rounded hover:text-c-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-brand">Home</Link></li>
              <li aria-hidden><ChevronRight className="h-3.5 w-3.5" /></li>
              <li><Link href="/blog" className="rounded hover:text-c-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-brand">Blog</Link></li>
              <li aria-hidden><ChevronRight className="h-3.5 w-3.5" /></li>
              <li aria-current="page" className="min-w-0 max-w-full truncate font-medium text-c-ink">{post.category}</li>
            </ol>
          </nav>
          <div className="mt-6 max-w-3xl">
            <CategoryTag>{post.category}</CategoryTag>
            <h1 className="mt-4 font-display text-[2rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl">{post.title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-c-muted">{post.excerpt}</p>
            <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-c-muted">
              <span>Written by the {BRAND_NAME} team</span><span aria-hidden>·</span>
              <time dateTime={post.date}>{formatDate(post.date)}</time><span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden />{post.readMinutes} min read</span>
            </p>
          </div>
        </div>
      </header>

      <div className={`${container} -mt-0 pt-8`}>
        <div className="overflow-hidden rounded-2xl border border-c-line aspect-[16/9] sm:aspect-[21/8]">
          <PostCover category={post.category} slug={post.slug} />
        </div>
      </div>

      <div className={`${container} grid gap-8 pt-10 xl:grid-cols-[220px_minmax(0,720px)] xl:justify-center xl:gap-16`}>
        <Toc items={toc} />

        <article id="post-body" className="min-w-0">
          <section aria-labelledby="tldr-h" className="rounded-xl border-2 border-c-ink bg-c-brand-soft p-5 sm:p-6">
            <h2 id="tldr-h" className="font-display text-sm font-semibold uppercase tracking-wide text-c-brand">TL;DR</h2>
            <ul className="mt-3 space-y-2.5">
              {post.tldr.map((t) => (
                <li key={t} className="relative pl-6 text-base leading-relaxed before:absolute before:left-0.5 before:top-[0.55em] before:h-2 before:w-2 before:rotate-45 before:bg-c-accent">{t}</li>
              ))}
            </ul>
          </section>

          {sections.map(({ s, id, blocks }, i) => (
            <div key={id}>
              <section aria-labelledby={id} className="mt-12">
                <h2 id={id} className="scroll-mt-28 font-display text-[1.65rem] font-semibold leading-tight tracking-tight sm:text-3xl">
                  <span className="mb-1 block font-display text-sm font-semibold tracking-[0.14em] text-c-accent" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                  {s.heading}
                </h2>
                {blocks.map(({ b, id: hid }, j) => <BlockView key={j} block={b} id={hid} />)}
              </section>
              {i === midAfter && <MidCta />}
            </div>
          ))}

          <div className="mt-14 border-t border-c-line pt-8">
            <ShareRow url={url} title={post.title} />
          </div>

          <aside aria-label="About the author" className="mt-8 flex items-start gap-4 rounded-xl border border-c-line bg-c-surface p-5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-c-brand font-display text-lg font-bold text-c-bg" aria-hidden>C</span>
            <div>
              <p className="font-display text-base font-semibold">The {BRAND_NAME} team</p>
              <p className="mt-1 text-sm leading-relaxed text-c-muted">We build comment-to-DM tools on Instagram&apos;s official API and write down what we learn from helping small businesses. {BRAND_NAME} is an independent product, not affiliated with or endorsed by Meta or Instagram.</p>
            </div>
          </aside>
        </article>
      </div>

      <section aria-labelledby="more-h" className={`${container} pt-16`}>
        <div className="flex items-end justify-between gap-4">
          <h2 id="more-h" className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Read more</h2>
          <Link href="/blog" className="rounded text-sm font-semibold text-c-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-brand">All articles</Link>
        </div>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {relatedPosts(post).map((p) => <li key={p.slug} className="flex"><PostCard post={toSummary(p)} /></li>)}
        </ul>
      </section>

      <CtaCard title="Turn your next comment into a conversation" />
    </PageShell>
  )
}
