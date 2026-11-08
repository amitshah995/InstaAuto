import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { MarketingPage } from "@/components/marketing/marketing-page"
import { BRAND_NAME } from "@/lib/site"
import { getPage, slugsFor } from "@/lib/marketing-nav"

export const dynamicParams = false
export const generateStaticParams = () => slugsFor("industries")

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const found = getPage("industries", slug)
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

export default async function IndustriesPage({ params }: Props) {
  const { slug } = await params
  if (!getPage("industries", slug)) notFound()
  return <MarketingPage section="industries" slug={slug} />
}
