import { embedUrl, watchUrl } from "@/lib/shop/video"
import { initialOf } from "@/lib/shop/core"
import type { PublicPost } from "@/lib/shop/posts-store"
import ReportButton from "@/components/shop/ReportButton"

/** One Studio post: swipe carousel or Instagram reel, caption, tagged products. Server-rendered, no client JS needed. */
export default function PostCard({ post, handle, permalink }: { post: PublicPost; handle: string; permalink?: boolean }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">{initialOf(handle)}</div>
        <a href={`/@${handle}`} className="text-sm font-bold">@{handle}</a>
      </header>

      {post.kind === "images" ? (
        <div className="flex snap-x snap-mandatory overflow-x-auto bg-muted [scrollbar-width:none]">
          {post.images.map((src, i) => (
            <div key={src} className="aspect-[4/5] w-full shrink-0 snap-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${post.caption?.slice(0, 80) || "Post"} (${i + 1}/${post.images.length})`} loading={i === 0 ? "eager" : "lazy"} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      ) : (
        <iframe
          src={embedUrl(post.reel_kind || "reel", post.reel_code || "")}
          title="Instagram video"
          loading="lazy"
          allow="encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
          className="block h-[560px] w-full"
        />
      )}
      {post.kind === "images" && post.images.length > 1 && (
        <p className="px-3 pt-2 text-[11px] text-muted-foreground">Swipe for more ({post.images.length} photos) →</p>
      )}

      {post.caption && <p className="whitespace-pre-line px-3 pt-2 text-sm">{post.caption}</p>}

      {post.products.length > 0 && (
        <ul className="flex gap-2 overflow-x-auto px-3 py-3 [scrollbar-width:none]">
          {post.products.map((p) => (
            <li key={p.slug} className="relative w-40 shrink-0 overflow-hidden rounded-xl border border-border">
              <a href={`/l/${p.slug}?s=p:${post.id}`} target="_blank" rel="nofollow noopener noreferrer sponsored" className="block">
                <div className="aspect-square bg-muted">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-2xl font-black text-muted-foreground/50">{initialOf(p.title)}</div>
                  )}
                </div>
                <p className="line-clamp-2 p-2 text-xs font-bold leading-snug">{p.title}</p>
                <span className="mx-2 mb-2 inline-block rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">Shop now</span>
              </a>
              <div className="absolute right-1 top-1"><ReportButton slug={p.slug} /></div>
            </li>
          ))}
        </ul>
      )}

      {post.products.some((p) => p.disclose) && (
        <p className="px-3 pb-3 text-[11px] text-muted-foreground">Some of these are affiliate links. The creator may earn a commission if you buy, at no extra cost to you.</p>
      )}
      <footer className="flex items-center justify-between px-3 pb-3 text-[11px] text-muted-foreground">
        {post.kind === "reel" ? (
          <a href={watchUrl(post.reel_kind || "reel", post.reel_code || "")} target="_blank" rel="noopener noreferrer" className="underline">Watch on Instagram</a>
        ) : <span />}
        {!permalink && <a href={`/@${handle}/p/${post.id}`} className="underline">Open post</a>}
      </footer>
    </article>
  )
}
