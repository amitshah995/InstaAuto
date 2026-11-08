import type { Metadata } from "next"
import { BlogIndex } from "@/components/blog/blog-index"
import { PageShell } from "@/components/marketing/page-shell"
import { POSTS } from "@/lib/blog/posts"
import { toSummary } from "@/lib/blog/summary"
import { BRAND_NAME, getSiteUrl } from "@/lib/site"

const TITLE = "Blog: guides, templates and safety habits for comment-to-DM"
const DESCRIPTION = `Plain-English articles from the ${BRAND_NAME} team on keywords, first messages, booking flows, reading your funnel and staying within Instagram's rules.`

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${getSiteUrl()}/blog` },
  openGraph: { type: "website", title: `${TITLE} | ${BRAND_NAME}`, description: DESCRIPTION, url: `${getSiteUrl()}/blog` },
}

export default function BlogPage() {
  const base = getSiteUrl()
  const ld = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${BRAND_NAME} blog`,
    url: `${base}/blog`,
    blogPost: POSTS.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${base}/blog/${p.slug}`, datePublished: p.date })),
  }
  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <BlogIndex posts={POSTS.map(toSummary)} />
    </PageShell>
  )
}
