import { watchUrl } from "@/lib/shop/video"
import type { PublicPost } from "@/lib/shop/posts-store"
import { discountPct, formatINR, initialOf } from "@/lib/shop/core"
import PostCarousel from "@/components/shop/PostCarousel"
import ReelPlayer from "@/components/shop/ReelPlayer"
import ReportButton from "@/components/shop/ReportButton"

/** Caption with #hashtags picked out in the accent colour. Plain text only, never HTML. */
function Caption({ text }: { text: string }) {
  const parts = text.split(/(#[\p{L}\p{N}_]+)/u)
  return (
    <p className="whitespace-pre-line text-[15px] font-medium leading-relaxed">
      {parts.map((p, i) => (p.startsWith("#") ? <span key={i} className="shop-tag">{p}</span> : p))}
    </p>
  )
}

/** Soft pastel backgrounds that rotate through the product cards so the strip looks lively. */
const TINTS = [
  "linear-gradient(135deg,#ffe3f1,#ffd1e8)",
  "linear-gradient(135deg,#e6e0ff,#d5ccff)",
  "linear-gradient(135deg,#ffeccc,#ffdca0)",
  "linear-gradient(135deg,#d9f3ff,#bfe6ff)",
  "linear-gradient(135deg,#dcf8e6,#c2f0d3)",
]

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
    <article className="shop-ring rounded-[1.75rem]">
    <div className="overflow-hidden rounded-[calc(1.75rem-2px)] bg-card">
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
          <ul className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {post.products.map((p, idx) => {
              const off = discountPct(p.price_inr, p.mrp_inr)
              return (
                <li key={p.slug} className="relative w-[17rem] shrink-0 rounded-2xl ring-1 ring-white/70 shadow-sm" style={{ background: TINTS[idx % TINTS.length] }}>
                  <a href={`/l/${p.slug}?s=p:${post.id}`} target="_blank" rel="nofollow noopener noreferrer sponsored" className="flex items-center gap-3 p-2 pr-3">
                    <span className="h-[4.5rem] w-14 shrink-0 overflow-hidden rounded-xl bg-background">
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-lg font-black text-muted-foreground/60">{initialOf(p.title)}</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-foreground">{p.title}</span>
                      {p.price_inr ? (
                        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
                          <span className="shop-price text-[17px] font-extrabold">{formatINR(p.price_inr)}</span>
                          {p.mrp_inr && p.mrp_inr > p.price_inr && <span className="text-xs text-foreground/50 line-through">{formatINR(p.mrp_inr)}</span>}
                          {off && <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[11px] font-bold text-white">{off}% off</span>}
                        </span>
                      ) : null}
                      <span className="shop-btn mt-1.5 inline-block rounded-full px-4 py-1.5 text-[12px] font-bold shadow">Shop now</span>
                    </span>
                  </a>
                  <span className="absolute right-0.5 top-0.5"><ReportButton slug={p.slug} /></span>
                </li>
              )
            })}
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
    </div>
    </article>
  )
}
