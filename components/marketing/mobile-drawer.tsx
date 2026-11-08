"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, ChevronDown, Globe, X } from "lucide-react"
import { MENUS, TOP_LINKS } from "@/lib/marketing-nav"
import { INSTAGRAM_AUTH_URL } from "@/lib/instagram-auth"
import { CelraLogo } from "@/components/ui/celra-logo"
import { useDialogA11y } from "./modal"
import { ThemeToggle } from "./theme-toggle"
import { btnOutline, btnPrimary, focusRing } from "./ui"

/** Right-side drawer for widths under 1000px: accordion sections, language and the two buttons at the bottom. */
export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  useDialogA11y(box, open, onClose)
  if (!open) return null

  const row = `flex min-h-12 w-full items-center justify-between rounded-[5px] px-3 text-[15px] font-semibold text-c-ink hover:bg-c-soft cursor-pointer ${focusRing}`
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-[#071A20]/60" onClick={onClose} aria-hidden />
      <div ref={box} role="dialog" aria-modal="true" aria-label="Menu" className="celra-drawer absolute right-0 top-0 flex h-full w-[300px] max-w-[88vw] flex-col bg-c-surface text-c-ink shadow-2xl">
        <div className="flex h-[65px] shrink-0 items-center justify-between border-b border-c-line px-4">
          <CelraLogo variant="full" size={30} />
          <button type="button" onClick={onClose} aria-label="Close menu" className={`grid h-10 w-10 cursor-pointer place-items-center rounded-full hover:bg-c-soft ${focusRing}`}>
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-2 py-3">
          <Link href={TOP_LINKS.pricing.href} onClick={onClose} className={row}>{TOP_LINKS.pricing.label}</Link>
          {MENUS.map((m) => {
            const isOpen = openKey === m.key
            return (
              <div key={m.key}>
                <button type="button" className={row} aria-expanded={isOpen} aria-controls={`dr-${m.key}`} onClick={() => setOpenKey(isOpen ? null : m.key)}>
                  {m.label}
                  <ChevronDown className={`h-4 w-4 text-c-muted transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                </button>
                <ul id={`dr-${m.key}`} hidden={!isOpen} className="mb-1 ml-3 border-l border-c-line pl-2">
                  {m.items.map((it) => (
                    <li key={it.href + it.title}>
                      <Link href={it.href} onClick={onClose} className={`flex items-center gap-3 rounded-[5px] px-2 py-2.5 text-sm text-c-ink hover:bg-c-soft ${focusRing}`}>
                        <it.icon className="h-5 w-5 shrink-0 text-c-brand" aria-hidden />
                        <span className="font-medium">{it.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          <Link href={TOP_LINKS.partner.href} onClick={onClose} className={row}>{TOP_LINKS.partner.label}</Link>
          <div className="mt-2 flex items-center justify-between px-3">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-c-muted"><Globe className="h-4 w-4" aria-hidden /> English</span>
            <ThemeToggle />
          </div>
        </nav>
        <div className="grid shrink-0 gap-3 border-t border-c-line p-4">
          <a href={INSTAGRAM_AUTH_URL} className={btnPrimary}>Start for free <ArrowRight className="h-4 w-4" aria-hidden /></a>
          <a href={INSTAGRAM_AUTH_URL} className={btnOutline}>Log in <ArrowRight className="h-4 w-4" aria-hidden /></a>
        </div>
      </div>
    </div>
  )
}
