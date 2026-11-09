import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPublicShop } from "@/lib/shop/store"
import ShopHeader from "@/components/shop/ShopHeader"
import ShopTabs from "@/components/shop/ShopTabs"
import ShopLinkGrid from "@/components/shop/ShopLinkGrid"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params
  return { title: `@${handle.replace(/^@|^%40/, "")} - Shop`, robots: { index: false, follow: false } }
}

export default async function ShopPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await params
  let shop = null
  try {
    shop = await getPublicShop(decodeURIComponent(raw))
  } catch (e) {
    console.error("[shop] page error:", (e as Error)?.message)
  }
  if (!shop) notFound()
  const { profile, links, hasStudio } = shop

  return (
    // @container: header and grid size themselves from this width, the same way the dashboard preview does.
    <div className="@container min-h-screen text-foreground">
      <ShopHeader handle={profile.handle} displayName={profile.display_name} bio={profile.bio} avatarUrl={profile.avatar_url} bannerUrl={profile.banner_url} />
      <div className="mx-auto max-w-6xl px-4 pb-16">
        {hasStudio ? <ShopTabs handle={profile.handle} active="shop" /> : <div className="h-6" />}
        <ShopLinkGrid links={links} />
      </div>
    </div>
  )
}
