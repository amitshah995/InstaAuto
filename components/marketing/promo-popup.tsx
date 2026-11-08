"use client"

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { ArrowRight, CalendarCheck, Sparkles } from "lucide-react"
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/site"
import { INSTAGRAM_AUTH_URL } from "@/lib/instagram-auth"
import { Modal } from "./modal"
import { btnPrimary, focusRing } from "./ui"

const SEEN_KEY = "celra-promo-seen"
const DEMO_EVENT = "celra:open-demo"
const PROMO_EVENT = "celra:open-promo"

const field = `h-11 w-full rounded-[5px] border border-c-line bg-c-bg px-3 text-[15px] text-c-ink placeholder:text-c-muted ${focusRing}`

/** Any button can open the "Join live demo" modal through this. */
export function DemoButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(DEMO_EVENT))}>
      {children}
    </button>
  )
}

/** Any button can open the early-access modal through this (it still counts as seen for this session). */
export function PromoButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(PROMO_EVENT))}>
      {children}
    </button>
  )
}

/**
 * Mounts both modals: the early-access popup (after ~8s or on exit intent, once per session,
 * never on /dashboard) and the live demo modal. Neither posts anywhere: the popup continues to
 * the Instagram connect flow, the demo form opens an email to support.
 */
export function PromoPopup() {
  const pathname = usePathname()
  const [promo, setPromo] = useState(false)
  const [demo, setDemo] = useState(false)
  const blocked = pathname?.startsWith("/dashboard")

  const showPromo = useCallback(() => {
    try { if (sessionStorage.getItem(SEEN_KEY)) return } catch {}
    if (document.querySelector('[role="dialog"]')) return
    try { sessionStorage.setItem(SEEN_KEY, "1") } catch {}
    setPromo(true)
  }, [])

  useEffect(() => {
    if (blocked) return
    const t = window.setTimeout(showPromo, 8000)
    const onLeave = (e: MouseEvent) => { if (e.clientY <= 0 && !e.relatedTarget) showPromo() }
    document.addEventListener("mouseout", onLeave)
    return () => { window.clearTimeout(t); document.removeEventListener("mouseout", onLeave) }
  }, [blocked, showPromo])

  useEffect(() => {
    const open = () => { setPromo(false); setDemo(true) }
    const openPromo = () => {
      try { sessionStorage.setItem(SEEN_KEY, "1") } catch {}
      setDemo(false)
      setPromo(true)
    }
    window.addEventListener(DEMO_EVENT, open)
    window.addEventListener(PROMO_EVENT, openPromo)
    return () => { window.removeEventListener(DEMO_EVENT, open); window.removeEventListener(PROMO_EVENT, openPromo) }
  }, [])

  if (blocked) return null

  const onPromo = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    window.location.href = INSTAGRAM_AUTH_URL
  }
  const onDemo = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const body = `Name: ${f.get("name") ?? ""}\nEmail: ${f.get("email") ?? ""}\n\nPlease share the next live demo time.`
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Live demo request")}&body=${encodeURIComponent(body)}`
    setDemo(false)
  }

  return (
    <>
      <Modal open={promo} onClose={() => setPromo(false)} label="Get early access">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-c-brand-soft text-c-brand" aria-hidden><Sparkles className="h-6 w-6" /></span>
        <h2 className="mt-4 font-display text-2xl font-semibold leading-tight">Get early access to {BRAND_NAME}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-c-muted">Free during beta. Turn the next comment on your reel into a DM. Add your email, then connect Instagram to begin.</p>
        <form onSubmit={onPromo} className="mt-5 grid gap-3">
          <label className="sr-only" htmlFor="promo-email">Email</label>
          <input id="promo-email" type="email" name="email" required autoComplete="email" placeholder="you@example.com" className={field} />
          <button type="submit" className={`${btnPrimary} w-full`}>Get early access <ArrowRight className="h-4 w-4" aria-hidden /></button>
        </form>
        <p className="mt-3 text-xs text-c-muted">Your email is not stored here. You sign in on Instagram next.</p>
      </Modal>

      <Modal open={demo} onClose={() => setDemo(false)} label="Join live demo">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-c-brand-soft text-c-brand" aria-hidden><CalendarCheck className="h-6 w-6" /></span>
        <h2 className="mt-4 font-display text-2xl font-semibold leading-tight">Join a live demo</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-c-muted">See comment-to-DM set up from scratch and ask questions. Tell us where to send the next date.</p>
        <form onSubmit={onDemo} className="mt-5 grid gap-3">
          <label className="sr-only" htmlFor="demo-name">Name</label>
          <input id="demo-name" name="name" required autoComplete="name" placeholder="Your name" className={field} />
          <label className="sr-only" htmlFor="demo-email">Email</label>
          <input id="demo-email" type="email" name="email" required autoComplete="email" placeholder="you@example.com" className={field} />
          <button type="submit" className={`${btnPrimary} w-full`}>Request a seat <ArrowRight className="h-4 w-4" aria-hidden /></button>
        </form>
        <p className="mt-3 text-xs text-c-muted">This opens an email to our team. Nothing is sent until you press send.</p>
      </Modal>
    </>
  )
}
