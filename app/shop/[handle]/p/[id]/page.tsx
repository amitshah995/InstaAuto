import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPublicPost } from "@/lib/shop/posts-store"
import PostCard from "@/components/shop/PostCard"

export const dynamic = "force-dynamic"

type Params = Promise<{ handle: string; id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { handle, id } = await params
  let found = null
  try { found = await getPublicPost(decodeURIComponent(handle), id) } catch { /* fall through */ }
  if (!found) return { title: "Post", robots: { index: false, follow: false } }
  const { post } = found
  const title = `@${found.handle} on DMSpark`
  const description = (post.caption || "New post").slice(0, 160)
  const image = post.kind === "images" ? post.images[0] : undefined
  // noindex for search engines; the preview tags are what WhatsApp / Instagram read when the link is shared.
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "article", images: image ? [image] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  }
}

export default async function PostPage({ params }: { params: Params }) {
  const { handle, id } = await params
  let found = null
  try { found = await getPublicPost(decodeURIComponent(handle), id) } catch (e) { console.error("[shop] post page error:", (e as Error)?.message) }
  if (!found) notFound()
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-md space-y-4 px-4 py-6">
        <PostCard post={found.post} handle={found.handle} permalink />
        <p className="text-center text-sm"><a href={`/@${found.handle}`} className="font-bold underline">See all of @{found.handle}&apos;s shop</a></p>
      </div>
    </main>
  )
}
