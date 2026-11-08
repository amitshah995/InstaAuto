import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { PageShell } from "@/components/marketing/page-shell"
import { CtaCard } from "@/components/marketing/sections/cta-card"
import { Faq } from "@/components/marketing/sections/faq"
import { CheckList, Pill, btnPrimary, container } from "@/components/marketing/ui"
import { BRAND_NAME } from "@/lib/site"
import { INSTAGRAM_AUTH_URL } from "@/lib/instagram-auth"
import { PLANS, PLAN_ORDER, billingEnabled, formatInr } from "@/lib/billing/plans"

// Rendered per request so flipping BILLING_ENABLED in Vercel changes the page without a code change.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Pricing",
  description: `Flat monthly ${BRAND_NAME} plans priced by DMs sent, never per contact. Free during beta.`,
  alternates: { canonical: "/pricing" },
}

export default function PricingPage() {
  const live = billingEnabled()
  return (
    <PageShell>
      <section className="mx-auto w-full max-w-[900px] px-4 pt-[50px] text-center sm:px-6">
        <Pill>Pricing</Pill>
        <h1 className="mt-5 font-display text-[2.25rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          {live ? "Flat plans. No per-contact fees." : "Free while we are in beta"}
        </h1>
        <p className="mx-auto mt-4 max-w-[600px] text-base leading-relaxed text-c-muted sm:text-lg">
          {live
            ? "You pay one flat monthly price in rupees. Plans are limited by DMs sent per month, not by how many followers or contacts you have."
            : "Use everything for free today. The plans below show how pricing is planned. Nothing is charged until we announce it, and we will tell you first."}
        </p>
      </section>
      <section className={`${container} pt-[48px]`}>
        <div className="mx-auto grid max-w-[1000px] gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id]
            return (
              <div key={id} className={`rounded-xl border bg-c-surface p-7 ${id === "starter" ? "border-2 border-c-brand" : "border-c-line"}`}>
                <p className="text-sm font-semibold text-c-brand">{p.name}</p>
                <p className="mt-2 font-display text-4xl font-semibold">{p.priceInrMonthly === 0 ? "Free" : formatInr(p.priceInrMonthly)}</p>
                <p className="mt-1 text-sm text-c-muted">
                  {p.priceInrMonthly === 0 ? "No card needed." : live ? "per month, flat" : "per month (planned, not charged during beta)"}
                </p>
                <p className="mt-4 text-sm font-medium">
                  {p.dmsPerMonth.toLocaleString("en-IN")} DMs / month · {p.aiRunsPerDay} AI runs / day · {p.seats} seat{p.seats === 1 ? "" : "s"}
                </p>
                <div className="mt-5"><CheckList items={p.highlights} /></div>
                <a href={INSTAGRAM_AUTH_URL} className={`${btnPrimary} mt-7 w-full`}>
                  {live ? (id === "free" ? "Start for free" : `Get ${p.name}`) : "Start for free"} <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </div>
            )
          })}
        </div>
        <p className="mx-auto mt-6 max-w-[700px] text-center text-sm text-c-muted">
          {live ? "Prices in INR. " : "Planned prices are examples and may change before launch. "}
          Cancel any time from your dashboard. See the <Link href="/refund-policy" className="underline">refund and cancellation policy</Link>.
        </p>
      </section>
      <Faq />
      <CtaCard />
    </PageShell>
  )
}
