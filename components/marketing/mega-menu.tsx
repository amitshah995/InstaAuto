"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Check, ChevronDown, type LucideIcon } from "lucide-react"
import type { NavItem } from "@/lib/marketing-nav"
import { focusRing } from "./ui"

/** Flyout card used by every dropdown in the header. Opens on hover and on keyboard focus. */
export function MegaMenu({ label, items, width = 270, icon: Icon }: { label: string; items: NavItem[]; width?: number; icon?: LucideIcon }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLLIElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const panelId = `mm-${label.toLowerCase().replace(/\W+/g, "-")}`

  return (
    <li
      ref={root}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => { if (!root.current?.contains(e.relatedTarget as Node)) setOpen(false) }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) { setOpen(false); btn.current?.focus() }
        if (e.key === "ArrowDown" && open) {
          const first = root.current?.querySelector<HTMLElement>("[role=menuitem], a")
          if (first) { e.preventDefault(); first.focus() }
        }
      }}
    >
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        onClick={() => setOpen(true)}
        className={`flex h-10 items-center gap-0.5 rounded-[5px] px-1.5 text-[14px] font-medium min-[1200px]:gap-1 min-[1200px]:px-2.5 min-[1200px]:text-[15px] text-c-ink hover:bg-c-soft cursor-pointer ${focusRing}`}
      >
        {Icon && <Icon className="h-4 w-4 text-c-muted" aria-hidden />}
        {label}
        <ChevronDown className={`h-4 w-4 text-c-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {/* pt-2 keeps the hover path continuous between the button and the card */}
      <div id={panelId} hidden={!open} className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2" style={{ width }}>
        <ul className="max-h-[calc(100vh-90px)] overflow-y-auto rounded-[5px] border border-c-line bg-c-surface p-2 shadow-[0_12px_32px_-8px_rgba(14,42,51,0.28)]">
          {items.map((it) => (
            <li key={it.href + it.title}>
              {it.href === "#" ? (
                <div aria-current="true" className="flex items-center gap-3 rounded-[5px] p-2.5">
                  <it.icon className="h-6 w-6 shrink-0 text-c-brand" aria-hidden />
                  <span className="flex-1 text-sm font-bold text-c-ink">{it.title}</span>
                  <Check className="h-4 w-4 text-c-brand" aria-hidden />
                </div>
              ) : (
                <Link href={it.href} onClick={() => setOpen(false)} className={`flex items-start gap-3 rounded-[5px] p-2.5 hover:bg-c-soft ${focusRing}`}>
                  <it.icon className="mt-0.5 h-6 w-6 shrink-0 text-c-brand" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight text-c-ink">{it.title}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-c-muted">{it.sub}</span>
                  </span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </li>
  )
}
