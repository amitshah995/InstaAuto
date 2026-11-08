"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Megaphone, X } from "lucide-react"
import { BRAND_NAME } from "@/lib/site"
import { focusRing } from "./ui"

const KEY = "celra-strip-dismissed"

/** Slim, dismissible strip under the header. */
export function AnnouncementStrip() {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    try { if (sessionStorage.getItem(KEY)) setHidden(true) } catch {}
  }, [])
  if (hidden) return null
  return (
    <div className="border-b border-c-line bg-c-cream text-c-ink">
      <div className="mx-auto flex min-h-11 max-w-[1600px] items-center justify-center gap-3 px-4 py-1.5 text-sm min-[1000px]:px-[30px]">
        <Megaphone className="hidden h-4 w-4 shrink-0 text-c-brand sm:block" aria-hidden />
        <p className="min-w-0 text-center leading-snug"><span className="hidden sm:inline">{BRAND_NAME} templates for links, prices and bookings are ready. </span><span className="sm:hidden">New: link, price and booking templates. </span></p>
        <Link href="/flow-templates" className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-c-brand px-3 py-1 text-xs font-semibold text-c-bg ${focusRing}`}>
          Grow your comments <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <button
          type="button"
          aria-label="Dismiss announcement"
          onClick={() => { setHidden(true); try { sessionStorage.setItem(KEY, "1") } catch {} }}
          className={`ml-1 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-c-muted hover:bg-c-soft hover:text-c-ink ${focusRing}`}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
