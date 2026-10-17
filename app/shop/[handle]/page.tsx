import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPublicShop } from "@/lib/shop/store"
import { initialOf, needsDisclosure } from "@/lib/shop/core"
import ReportButton from "@/components/shop/ReportButton"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params
  return { title: `@${handle.replace(/^@|^%40/, "")} - links`, robots: { index: false, follow: false } }
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
  const { profile, links } = shop
  const name = profile.display_name || `@${profile.handle}`

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-black text-primary">
            {initialOf(name)}
          </div>
          <h1 className="text-xl font-black">{name}</h1>
          <p className="text-xs text-muted-foreground">@{profile.handle}</p>
          {profile.bio && <p className="text-sm text-muted-foreground whitespace-pre-line">{profile.bio}</p>}
        </div>

        {links.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {links.map((l) => (
              <li key={l.slug} className="relative overflow-hidden rounded-2xl border border-border bg-card">
                <a
                  href={`/l/${l.slug}?s=shop`}
                  target="_blank"
                  rel="nofollow noopener noreferrer sponsored"
                  className="block"
                >
                  <div className="aspect-[3/4] w-full bg-muted">
                    {l.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.image_url}
                        alt={l.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl font-black text-muted-foreground/50">
                        {initialOf(l.title)}
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="line-clamp-2 text-sm font-bold leading-snug">{l.title}</p>
                    <span className="mt-2 inline-block rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                      Shop now
                    </span>
                  </div>
                </a>
                <div className="absolute right-1.5 top-1.5">
                  <ReportButton slug={l.slug} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {needsDisclosure(links) && (
          <p className="text-center text-xs text-muted-foreground">
            Some of these are affiliate links. The creator may earn a commission if you buy, at no extra cost to you.
          </p>
        )}
      </div>
    </main>
  )
}
