import { watchUrl } from "@/lib/shop/video"
import type { PublicPost } from "@/lib/shop/posts-store"
import { initialOf } from "@/lib/shop/core"
import PostCarousel from "@/components/shop/PostCarousel"
import ReelPlayer from "@/components/shop/ReelPlayer"
import ReportButton from "@/components/shop/ReportButton"

/** Caption with #hashtags picked out in the accent colour. Plain text only, never HTML. */
function Caption({ text }: { text: string }) {
  const parts = text.split(/(#[\p{L}\p{N}_]+)/u)
  return (
    <p className="whitespace-pre-line text-[15px] leading-relaxed">
      {parts.map((p, i) => (p.startsWith("#") ? <span key={i} className="text-primary">{p}</span> : p))}
    </p>
  )
}

const day = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })
  } catch {
    return ""
  }
}

/** One Studio post: swipe carousel or the creator's own reel, caption, tagged products. The visitor never has to leave. */
export default function PostCard({ post, handle, permalink }: { post: PublicPost; handle: string; permalink?: boolean }) {
  return (
    <article className="overflow-hidden rounded-[1.75rem] bg-card ring-1 ring-border">
      {post.kind === "images" ? (
        <PostCarousel images={post.images} alt={post.caption?.slice(0, 80) || `Post by @${handle}`} />
      ) : post.video_url ? (
        <ReelPlayer src={post.video_url} poster={post.poster_url} watchHref={post.reel_code ? watchUrl(post.reel_kind || "reel", post.reel_code) : null} />
      ) : (
        <div className="grid aspect-[4/5] place-items-center bg-muted px-6 text-center text-sm text-muted-foreground">
          {post.poster_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.poster_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            "This video is not available right now."
          )}
        </div>
      )}

      <div className="space-y-4 p-4">
        {post.caption && <Caption text={post.caption} />}

        {post.products.length > 0 && (
          <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {post.products.map((p) => (
              <li key={p.slug} className="flex w-56 shrink-0 items-center gap-1 rounded-2xl bg-muted/70 p-1.5">
                <a href={`/l/${p.slug}?s=p:${post.id}`} target="_blank" rel="nofollow noopener noreferrer sponsored" className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-background">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-lg font-black text-muted-foreground/60">{initialOf(p.title)}</span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{p.title}</span>
                    <span className="text-[12px] font-bold text-primary">Shop now</span>
                  </span>
                </a>
                <ReportButton slug={p.slug} />
              </li>
            ))}
          </ul>
        )}

        {post.products.some((p) => p.disclose) && (
          <p className="text-xs leading-relaxed text-muted-foreground">Some of these are affiliate links. The creator may earn a commission if you buy, at no extra cost to you.</p>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{day(post.created_at)}</span>
          {!permalink && <a href={`/@${handle}/studio/${post.id}`} className="font-semibold hover:text-foreground">Open post</a>}
        </div>
      </div>
    </article>
  )
}
