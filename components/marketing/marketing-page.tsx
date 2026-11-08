import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"
import { getPage, type SectionKey } from "@/lib/marketing-nav"
import { INSTAGRAM_AUTH_URL } from "@/lib/instagram-auth"
import { PageShell } from "./page-shell"
import { CtaCard } from "./sections/cta-card"
import { Pill, btnOutline, btnPrimary, container, focusRing } from "./ui"

/** Generic page for /product/[slug], /features/[slug], /industries/[slug], /resources/[slug], /integrations/[slug]. */
export function MarketingPage({ section, slug }: { section: SectionKey; slug: string }) {
  const found = getPage(section, slug)
  if (!found || !found.item.page) return null
  const { item, menu } = found
  const page = item.page!
  const related = menu.items.filter((i) => i.href !== item.href)
  return (
    <PageShell>
      <section className="mx-auto w-full max-w-[1000px] px-4 pt-[50px] text-center sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Pill>{menu.label}</Pill>
          {page.status && <span className="rounded-full bg-c-accent px-3 py-1 text-xs font-bold text-c-accent-ink">{page.status}</span>}
        </div>
        <span className="mx-auto mt-6 grid h-14 w-14 place-items-center rounded-xl bg-c-brand-soft text-c-brand" aria-hidden><item.icon className="h-7 w-7" /></span>
        <h1 className="mx-auto mt-5 max-w-[860px] font-display text-[2.25rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl">{page.heading}</h1>
        <p className="mx-auto mt-4 max-w-[640px] text-base leading-relaxed text-c-muted sm:text-lg">{page.lead}</p>
        <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <a href={INSTAGRAM_AUTH_URL} className={`${btnPrimary} !min-h-12 !px-7`}>Start for free <ArrowRight className="h-4 w-4" aria-hidden /></a>
          <Link href="/" className={`${btnOutline} !min-h-12 !px-7`}>Back to home</Link>
        </div>
      </section>

      <section className={`${container} pt-[56px]`} aria-label="Highlights">
        <ul className="grid gap-4 md:grid-cols-3">
          {page.points.map((pt) => (
            <li key={pt} className="flex items-start gap-3 rounded-xl border border-c-line bg-c-surface p-6">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-c-brand-soft text-c-brand" aria-hidden><Check className="h-4 w-4" strokeWidth={3} /></span>
              <h2 className="font-display text-lg font-semibold leading-snug">{pt}</h2>
            </li>
          ))}
        </ul>
      </section>

      <section className={`${container} pt-[56px]`} aria-labelledby="related-h">
        <h2 id="related-h" className="font-display text-2xl font-semibold">More in {menu.label}</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((r) => (
            <li key={r.href + r.title}>
              <Link href={r.href} className={`flex h-full items-start gap-3 rounded-xl border border-c-line bg-c-surface p-4 hover:bg-c-soft ${focusRing}`}>
                <r.icon className="mt-0.5 h-6 w-6 shrink-0 text-c-brand" aria-hidden />
                <span><span className="block text-sm font-bold">{r.title}</span><span className="mt-0.5 block text-xs text-c-muted">{r.sub}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <CtaCard />
    </PageShell>
  )
}

