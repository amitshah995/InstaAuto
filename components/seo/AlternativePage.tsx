import Link from "next/link"
import { Check } from "lucide-react"
import type { AltPage } from "@/lib/seo/alternatives"
import { ALT_PAGES } from "@/lib/seo/alternatives"
import { BRAND_NAME } from "@/lib/site"
import { PageShell } from "@/components/marketing/page-shell"

export function AlternativePage({ page }: { page: AltPage }) {
  const others = ALT_PAGES.filter((p) => p.slug !== page.slug)
  return (
    <PageShell strip={false}>
    <div className="text-c-ink  min-h-[60vh]">
      <div className="mx-auto max-w-3xl space-y-10 px-4 py-14">
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-c-brand">{BRAND_NAME} vs {page.competitor}</p>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{page.title}</h1>
          <p className="text-lg text-c-muted">{page.intro}</p>
          <Link href="/" className="inline-block rounded-[5px] bg-c-accent px-5 py-2.5 text-sm font-semibold text-c-accent-ink">
            Try {BRAND_NAME}
          </Link>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Why people look for an alternative</h2>
          <ul className="space-y-2">
            {page.whyLook.map((t) => (
              <li key={t} className="flex gap-2 text-c-muted"><Check className="mt-1 h-4 w-4 shrink-0 text-c-brand" />{t}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">What {BRAND_NAME} does</h2>
          <div className="overflow-hidden rounded-xl border border-c-line bg-c-surface">
            {page.comparison.map((r) => (
              <div key={r.feature} className="grid grid-cols-1 gap-1 border-b border-c-line px-4 py-3 last:border-0 sm:grid-cols-2">
                <span className="text-sm font-medium">{r.feature}</span>
                <span className="text-sm text-c-muted">{r.celra}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-c-muted">
            We describe only {BRAND_NAME} here. {page.competitor} changes plans and features often, so please check their site for their current
            features and pricing before you decide.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Who it fits</h2>
          <ul className="list-disc space-y-1 pl-5 text-c-muted">{page.fits.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>

        <section className="space-y-3 rounded-xl border border-c-line bg-c-cream p-5">
          <h2 className="text-lg font-semibold">When {BRAND_NAME} is not the right choice</h2>
          <ul className="list-disc space-y-1 pl-5 text-c-muted">{page.notFor.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>

        <footer className="flex flex-wrap gap-4 border-t border-c-line pt-6 text-sm text-c-muted">
          {others.map((o) => <Link key={o.slug} href={`/${o.slug}`} className="underline">{o.competitor} alternative</Link>)}
          <Link href="/flow-templates" className="underline">Flow templates</Link>
        </footer>
      </div>
    </div>
    </PageShell>
  )
}
