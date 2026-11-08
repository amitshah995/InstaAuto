import type { Metadata } from "next"
import Link from "next/link"
import { PageShell } from "@/components/marketing/page-shell"
import { CelraLogo } from "@/components/ui/celra-logo"
import { btnOutline, btnPrimary, container } from "@/components/marketing/ui"

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } }

export default function NotFound() {
  return (
    <PageShell strip={false}>
      <section className={`${container} flex min-h-[60vh] flex-col items-center justify-center gap-5 py-20 text-center`}>
        <CelraLogo variant="mark" size={56} />
        <p className="text-sm font-semibold uppercase tracking-widest text-c-brand">Error 404</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">This page does not exist</h1>
        <p className="max-w-md text-c-muted">The link may be old or mistyped. Go back home, or open your dashboard.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className={btnPrimary}>Back to home</Link>
          <Link href="/dashboard" className={btnOutline}>Open dashboard</Link>
        </div>
      </section>
    </PageShell>
  )
}
