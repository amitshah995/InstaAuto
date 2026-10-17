import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ArrowUpRight } from "lucide-react"
import { getPublicShop } from "@/lib/shop/store"
import { discountPct, formatINR, initialOf, needsDisclosure } from "@/lib/shop/core"
import ShopHeader from "@/components/shop/ShopHeader"
import ShopTabs from "@/components/shop/ShopTabs"
import ReportButton from "@/components/shop/ReportButton"

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
    <main className="min-h-screen bg-background text-foreground">
      <ShopHeader handle={profile.handle} displayName={profile.display_name} bio={profile.bio} />
      <div className="mx-auto max-w-6xl px-4 pb-16">
        {hasStudio ? <ShopTabs handle={profile.handle} active="shop" /> : <div className="h-6" />}

        {links.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Nothing here yet. Check back soon.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-7 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
            {links.map((l) => (
              <li key={l.slug} className="group relative">
                <a href={`/l/${l.slug}?s=shop`} target="_blank" rel="nofollow noopener noreferrer sponsored" className="block">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[1.4rem] bg-muted">
                    {l.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.image_url}
                        alt={l.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-5xl font-black text-muted-foreground/40">{initialOf(l.title)}</div>
                    )}
                    <span className="absolute bottom-2.5 right-2.5 grid h-9 w-9 place-items-center rounded-full bg-background/90 text-foreground shadow-sm">
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                  <p className="mt-2.5 line-clamp-2 text-[15px] font-semibold leading-snug">{l.title}</p>
                  {l.price_inr ? (
                    <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                      <span className="text-[15px] font-bold">{formatINR(l.price_inr)}</span>
                      {l.mrp_inr && l.mrp_inr > l.price_inr && <span className="text-xs text-muted-foreground line-through">{formatINR(l.mrp_inr)}</span>}
                      {discountPct(l.price_inr, l.mrp_inr) && <span className="text-xs font-bold text-emerald-600">{discountPct(l.price_inr, l.mrp_inr)}% off</span>}
                    </p>
                  ) : (
                    l.network && <p className="mt-0.5 text-xs text-muted-foreground">{l.network}</p>
                  )}
                </a>
                <div className="absolute left-2 top-2">
                  <ReportButton slug={l.slug} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {needsDisclosure(links) && (
          <p className="mx-auto mt-12 max-w-md text-center text-xs leading-relaxed text-muted-foreground">
            Some of these are affiliate links. The creator may earn a commission if you buy, at no extra cost to you.
          </p>
        )}
      </div>
    </main>
  )
}
