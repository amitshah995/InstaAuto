"use client"

import { useEffect, useState } from "react"
import { ListTree } from "lucide-react"
import { focusRing } from "@/components/marketing/ui"

export type TocItem = { id: string; text: string; level: 2 | 3 }

function useActive(items: TocItem[]) {
  const [active, setActive] = useState(items[0]?.id ?? "")
  useEffect(() => {
    let raf = 0
    const run = () => {
      raf = 0
      let cur = items[0]?.id ?? ""
      for (const it of items) {
        const el = document.getElementById(it.id)
        if (el && el.getBoundingClientRect().top <= 140) cur = it.id
      }
      setActive(cur)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(run) }
    run()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [items])
  return active
}

function List({ items, active }: { items: TocItem[]; active: string }) {
  return (
    <ol className="space-y-0.5 border-l border-c-line">
      {items.map((it) => {
        const on = it.id === active
        return (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              aria-current={on ? "location" : undefined}
              className={`-ml-px block border-l-2 py-1.5 pr-2 text-sm leading-snug ${it.level === 3 ? "pl-7" : "pl-4"} ${on ? "border-c-accent font-semibold text-c-ink" : "border-transparent text-c-muted hover:text-c-ink"} ${focusRing} rounded-r`}
            >
              {it.text}
            </a>
          </li>
        )
      })}
    </ol>
  )
}

/** Sticky outline on wide screens, a collapsible block on small ones. */
export function Toc({ items }: { items: TocItem[] }) {
  const active = useActive(items)
  return (
    <>
      <nav aria-label="Table of contents" className="sticky top-24 hidden max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 xl:block">
        <p className="mb-3 flex items-center gap-2 font-display text-sm font-semibold"><ListTree className="h-4 w-4 text-c-brand" aria-hidden />On this page</p>
        <List items={items} active={active} />
      </nav>
      <details className="rounded-xl border border-c-line bg-c-surface xl:hidden">
        <summary className={`flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-xl px-4 font-display text-sm font-semibold ${focusRing} [&::-webkit-details-marker]:hidden`}>
          <ListTree className="h-4 w-4 text-c-brand" aria-hidden />In this article
        </summary>
        <nav aria-label="Table of contents (mobile)" className="px-4 pb-4 pt-1"><List items={items} active={active} /></nav>
      </details>
    </>
  )
}
