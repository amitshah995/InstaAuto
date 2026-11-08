import { ArrowRight } from "lucide-react"
import { BRAND_NAME } from "@/lib/site"
import { HERO_CTA_LABEL } from "@/lib/marketing-nav"
import { INSTAGRAM_AUTH_URL } from "@/lib/instagram-auth"
import { DemoButton } from "../promo-popup"
import { Pill, btnOutline, btnPrimary } from "../ui"
import { CommentThread, DmCard, StatsCard } from "./visuals"

export function Hero() {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 pt-[50px] text-center sm:px-6">
      <Pill>Instagram comment to DM, free during beta</Pill>
      <h1 className="mx-auto mt-5 max-w-[900px] font-display text-[2.25rem] font-semibold leading-[1.08] tracking-tight sm:text-[3.5rem]">
        <span className="sr-only">{BRAND_NAME}: </span>
        Turn every comment <span className="text-c-brand">into a DM.</span>
      </h1>
      <p className="mx-auto mt-5 max-w-[640px] text-base leading-relaxed text-c-muted sm:text-lg">
        {BRAND_NAME} sends the price, link or details to anyone who comments on your reel, automatically, through the official Instagram API.
      </p>
      <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <a href={INSTAGRAM_AUTH_URL} className={`${btnPrimary} !min-h-12 !px-7 !text-base`}>{HERO_CTA_LABEL} <ArrowRight className="h-4 w-4" aria-hidden /></a>
        <DemoButton className={`${btnOutline} !min-h-12 !px-7 !text-base`}>Watch live demo <ArrowRight className="h-4 w-4" aria-hidden /></DemoButton>
      </div>
      <p className="mt-4 text-sm text-c-muted">No password needed. Pause or stop any time.</p>

      <div className="mt-12 rounded-2xl border border-c-line bg-c-soft p-4 text-left sm:p-6" role="group" aria-label="Example: a comment becomes a DM, an order, and a report">
        <div className="grid items-start gap-4 md:grid-cols-3">
          <CommentThread />
          <DmCard />
          <StatsCard />
        </div>
        <p className="mt-3 text-center text-xs text-c-muted">Drawn example. Names, messages and numbers are samples.</p>
      </div>
    </section>
  )
}
