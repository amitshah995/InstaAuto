"use client"

import type { FormEvent } from "react"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { BRAND_NAME } from "@/lib/site"
import { INSTAGRAM_AUTH_URL } from "@/lib/instagram-auth"
import { CheckList, Pill, btnPrimary, container, focusRing } from "../ui"

const field = `h-11 w-full rounded-[5px] border border-c-line bg-c-bg px-3 text-[15px] text-c-ink placeholder:text-c-muted ${focusRing}`

export function Signup() {
  const go = (e: FormEvent) => { e.preventDefault(); window.location.href = INSTAGRAM_AUTH_URL }
  return (
    <section id="signup" className="scroll-mt-20 pt-[72px]" aria-labelledby="signup-h">
      <div className={container}>
        <div className="grid gap-8 rounded-2xl bg-c-brand-soft p-5 sm:p-10 lg:grid-cols-2 lg:items-center lg:gap-12">
          <div>
            <Pill>Free during beta</Pill>
            <h2 id="signup-h" className="mt-4 font-display text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-4xl">Start getting more from your comments today</h2>
            <p className="mt-3 text-base leading-relaxed text-c-muted sm:text-lg">Set up your first automation in minutes. No card, no setup fee.</p>
            <div className="mt-6"><CheckList items={["Reply to every comment with a DM", "Start from ready templates", "Invite your team with seats", "Free Instagram audit included"]} /></div>
            <p className="mt-6 flex items-center gap-2 text-sm text-c-muted"><ShieldCheck className="h-4 w-4 shrink-0 text-c-brand" aria-hidden /> Official Instagram API. We never ask for your password.</p>
          </div>
          <form onSubmit={go} className="rounded-xl border border-c-line bg-c-surface p-5 sm:p-7">
            <h3 className="font-display text-xl font-semibold">Create your {BRAND_NAME} account</h3>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-medium">Name <span className="sr-only">(optional)</span><input name="name" autoComplete="name" placeholder="Your name" className={field} /></label>
              <label className="grid gap-1 text-sm font-medium">Email <span className="sr-only">(optional)</span><input name="email" type="email" autoComplete="email" placeholder="you@example.com" className={field} /></label>
              <label className="grid gap-1 text-sm font-medium">Phone <span className="sr-only">(optional)</span><input name="phone" type="tel" autoComplete="tel" placeholder="Phone number" className={field} /></label>
            </div>
            <button type="submit" className={`${btnPrimary} mt-5 w-full !min-h-12`}>Connect Instagram <ArrowRight className="h-4 w-4" aria-hidden /></button>
            <p className="mt-3 text-xs leading-relaxed text-c-muted">These fields are optional and are not sent anywhere. You sign in on Instagram&apos;s own login next.</p>
          </form>
        </div>
      </div>
    </section>
  )
}
