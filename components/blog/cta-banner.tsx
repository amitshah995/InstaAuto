import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { INSTAGRAM_AUTH_URL } from "@/lib/instagram-auth"
import { BRAND_NAME } from "@/lib/site"
import { btnPrimary, focusRing } from "@/components/marketing/ui"

/** Banner dropped into the middle of an article. */
export function MidCta() {
  return (
    <aside aria-label={`Try ${BRAND_NAME}`} className="my-12 overflow-hidden rounded-2xl border border-c-line bg-c-cream p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-xl font-semibold leading-snug sm:text-2xl">Want this running on your next reel?</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-c-muted">Connect your account, pick a template and switch it on. It uses Instagram&apos;s official login, and you stay in control of every message.</p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2">
          <a href={INSTAGRAM_AUTH_URL} className={btnPrimary}>Start for free <ArrowRight className="h-4 w-4" aria-hidden /></a>
          <Link href="/flow-templates" className={`rounded text-sm font-semibold text-c-brand hover:underline ${focusRing}`}>See flow templates</Link>
        </div>
      </div>
    </aside>
  )
}
