import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPublicStudio } from "@/lib/shop/posts-store"
import ShopHeader from "@/components/shop/ShopHeader"
import ShopTabs from "@/components/shop/ShopTabs"
import PostCard from "@/components/shop/PostCard"

export const dynamic = "force-dynamic"

type Params = Promise<{ handle: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle } = await params
  return { title: `@${handle.replace(/^@|^%40/, "")} - Studio`, robots: { index: false, follow: false } }
}

export default async function StudioPublicPage({ params }: { params: Params }) {
  const { handle: raw } = await params
  let studio = null
  try {
    studio = await getPublicStudio(decodeURIComponent(raw))
  } catch (e) {
    console.error("[shop] studio page error:", (e as Error)?.message)
  }
  if (!studio) notFound()
  return (
    <main className="min-h-screen text-foreground">
      <ShopHeader handle={studio.handle} displayName={studio.displayName} bio={studio.bio} avatarUrl={studio.avatarUrl} bannerUrl={studio.bannerUrl} />
      <div className="mx-auto max-w-6xl px-4 pb-16">
        <ShopTabs handle={studio.handle} active="studio" />
        {studio.posts.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No posts yet. Check back soon.</p>
        ) : (
          <div className="mx-auto grid max-w-md items-start gap-6 sm:max-w-none sm:grid-cols-2 lg:grid-cols-3">
            {studio.posts.map((p) => <PostCard key={p.id} post={p} handle={studio.handle} />)}
          </div>
        )}
      </div>
    </main>
  )
}
