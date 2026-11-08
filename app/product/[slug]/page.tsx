import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { MarketingPage } from "@/components/marketing/marketing-page"
import { BRAND_NAME } from "@/lib/site"
import { getPage, slugsFor } from "@/lib/marketing-nav"

export const dynamicParams = false
export const generateStaticParams = () => slugsFor("product")

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const found = getPage("product", slug)
  if (!found?.item.page) return {}
  return {
    title: found.item.title,
    description: found.item.page.lead,
    alternates: { canonical: found.item.href },
    // Placeholder pages stay out of search results until the copy is final.
    robots: found.item.page.status ? { index: false, follow: true } : undefined,
    openGraph: { title: `${found.item.title} | ${BRAND_NAME}` },
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  if (!getPage("product", slug)) notFound()
  return <MarketingPage section="product" slug={slug} />
}
