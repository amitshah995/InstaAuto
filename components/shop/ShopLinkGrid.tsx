import { ArrowUpRight } from "lucide-react"
import { discountPct, formatINR, initialOf, needsDisclosure, type ShopLink } from "@/lib/shop/core"
import ReportButton from "@/components/shop/ReportButton"

const TINTS = ["var(--c-brand-soft)", "var(--c-cream)", "var(--c-soft)", "var(--c-brand-soft)", "var(--c-cream)"]

/**
 * The product tiles, footer disclosure and "Made with Celra" mark of the public page.
 * `preview` renders the identical markup inside the dashboard phone frame, but with inert tiles
 * (no navigation, no report button) so nothing in the preview can be clicked through to a live link.
 */
export default function ShopLinkGrid({ links, preview = false }: { links: ShopLink[]; preview?: boolean }) {
  return (
    <div className="@container">
      {links.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Nothing here yet. Check back soon.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-6 @2xl:grid-cols-3 @4xl:grid-cols-4 @2xl:gap-x-5 @2xl:gap-y-7">
          {links.map((l, idx) => {
            const Tag = preview ? "div" : "a"
            const linkProps = preview ? {} : { href: `/l/${l.slug}?s=shop`, target: "_blank", rel: "nofollow noopener noreferrer sponsored" }
            return (
              <li key={l.slug} className="shop-card group relative">
                <Tag {...(linkProps as any)} className="block rounded-[1.4rem] outline-none focus-visible:ring-2 focus-visible:ring-c-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                  <div className="shop-ring rounded-[1.4rem]">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[calc(1.4rem-1px)]" style={{ background: TINTS[idx % TINTS.length] }}>
                      {l.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.image_url} alt={l.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-5xl font-black text-c-brand/40">{initialOf(l.title)}</div>
                      )}
                      <span className="absolute bottom-2.5 right-2.5 grid h-9 w-9 place-items-center rounded-full bg-c-accent text-c-accent-ink shadow-sm transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none">
                        <ArrowUpRight className="h-4 w-4" aria-hidden />
                      </span>
                    </div>
                  </div>
                  <p className="mt-2.5 line-clamp-2 text-[15px] font-bold leading-snug">{l.title}</p>
                  {l.price_inr ? (
                    <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
                      <span className="shop-price text-[17px] font-extrabold">{formatINR(l.price_inr)}</span>
                      {l.mrp_inr && l.mrp_inr > l.price_inr && <span className="text-xs text-foreground/50 line-through">{formatINR(l.mrp_inr)}</span>}
                      {discountPct(l.price_inr, l.mrp_inr) && <span className="rounded-full bg-c-accent px-1.5 py-0.5 text-[11px] font-bold text-c-accent-ink">{discountPct(l.price_inr, l.mrp_inr)}% off</span>}
                    </p>
                  ) : (
                    l.network && <p className="mt-0.5 text-xs text-muted-foreground">{l.network}</p>
                  )}
                </Tag>
                {!preview && (
                  <div className="absolute left-2 top-2">
                    <ReportButton slug={l.slug} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {needsDisclosure(links) && (
        <p className="mx-auto mt-10 max-w-md text-center text-xs leading-relaxed text-muted-foreground">
          Some of these are affiliate links. The creator may earn a commission if you buy, at no extra cost to you.
        </p>
      )}
      <p className="mt-6 text-center text-xs">
        {/* Soft growth loop: every public page points back to Celra, but quietly. */}
        <a href="/" className="shop-made font-medium underline-offset-4 hover:underline">Made with Celra</a>
      </p>
    </div>
  )
}
