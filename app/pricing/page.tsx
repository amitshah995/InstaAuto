import type { Metadata } from "next"
import { ArrowRight } from "lucide-react"
import { PageShell } from "@/components/marketing/page-shell"
import { CtaCard } from "@/components/marketing/sections/cta-card"
import { Faq } from "@/components/marketing/sections/faq"
import { CheckList, Pill, btnPrimary, container } from "@/components/marketing/ui"
import { BRAND_NAME } from "@/lib/site"
import { INSTAGRAM_AUTH_URL } from "@/lib/instagram-auth"

export const metadata: Metadata = {
  title: "Pricing",
  description: `${BRAND_NAME} is free to use while it is in beta. Paid plans will be announced before anything changes.`,
  alternates: { canonical: "/pricing" },
}

export default function PricingPage() {
  return (
    <PageShell>
      <section className="mx-auto w-full max-w-[900px] px-4 pt-[50px] text-center sm:px-6">
        <Pill>Pricing</Pill>
        <h1 className="mt-5 font-display text-[2.25rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl">Free while we are in beta</h1>
        <p className="mx-auto mt-4 max-w-[600px] text-base leading-relaxed text-c-muted sm:text-lg">Use everything for free today. When paid plans arrive, we will tell you first and charge nothing without your yes.</p>
      </section>
      <section className={`${container} pt-[48px]`}>
        <div className="mx-auto grid max-w-[900px] gap-4 md:grid-cols-2">
          <div className="rounded-xl border-2 border-c-brand bg-c-surface p-7">
            <p className="text-sm font-semibold text-c-brand">Beta</p>
            <p className="mt-2 font-display text-5xl font-semibold">Free</p>
            <p className="mt-1 text-sm text-c-muted">No card. No setup fee.</p>
            <div className="mt-6"><CheckList items={["Comment-to-DM and story replies", "DM flows and templates library", "Shared inbox, contacts and tags", "Reports, funnel and free audit", "Team seats"]} /></div>
            <a href={INSTAGRAM_AUTH_URL} className={`${btnPrimary} mt-7 w-full`}>Start for free <ArrowRight className="h-4 w-4" aria-hidden /></a>
          </div>
          <div className="rounded-xl border border-dashed border-c-line bg-c-cream p-7">
            <p className="text-sm font-semibold text-c-muted">After beta</p>
            <p className="mt-2 font-display text-3xl font-semibold">Plans to be announced</p>
            <p className="mt-3 text-[15px] leading-relaxed text-c-muted">We are still working out fair plans for small creators and larger teams. No prices are set yet, so none are shown here.</p>
          </div>
        </div>
      </section>
      <Faq />
      <CtaCard />
    </PageShell>
  )
}
