import Link from "next/link"
import { Check } from "lucide-react"
import type { AltPage } from "@/lib/seo/alternatives"
import { ALT_PAGES } from "@/lib/seo/alternatives"

export function AlternativePage({ page }: { page: AltPage }) {
  const others = ALT_PAGES.filter((p) => p.slug !== page.slug)
  return (
    <main className="min-h-screen font-sans bg-gradient-to-b from-fuchsia-50 via-white to-white text-neutral-900">
      <div className="mx-auto max-w-3xl space-y-10 px-4 py-14">
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-600">DMSpark vs {page.competitor}</p>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{page.title}</h1>
          <p className="text-lg text-neutral-600">{page.intro}</p>
          <Link href="/" className="inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white">
            Try DMSpark
          </Link>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Why people look for an alternative</h2>
          <ul className="space-y-2">
            {page.whyLook.map((t) => (
              <li key={t} className="flex gap-2 text-neutral-700"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />{t}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">What DMSpark does</h2>
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            {page.comparison.map((r) => (
              <div key={r.feature} className="grid grid-cols-1 gap-1 border-b border-neutral-100 px-4 py-3 last:border-0 sm:grid-cols-2">
                <span className="text-sm font-medium">{r.feature}</span>
                <span className="text-sm text-neutral-600">{r.dmspark}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-neutral-500">
            We describe only DMSpark here. {page.competitor} changes plans and features often, so please check their site for their current
            features and pricing before you decide.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Who it fits</h2>
          <ul className="list-disc space-y-1 pl-5 text-neutral-700">{page.fits.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>

        <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold">When DMSpark is not the right choice</h2>
          <ul className="list-disc space-y-1 pl-5 text-neutral-700">{page.notFor.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>

        <footer className="flex flex-wrap gap-4 border-t border-neutral-200 pt-6 text-sm text-neutral-500">
          {others.map((o) => <Link key={o.slug} href={`/${o.slug}`} className="underline">{o.competitor} alternative</Link>)}
          <Link href="/flow-templates" className="underline">Flow templates</Link>
        </footer>
      </div>
    </main>
  )
}
