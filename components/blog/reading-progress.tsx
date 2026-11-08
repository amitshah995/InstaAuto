"use client"

import { useEffect, useRef } from "react"

/** Thin bar at the very top that fills as you read the article element. */
export function ReadingProgress({ targetId }: { targetId: string }) {
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const run = () => {
      raf = 0
      const el = document.getElementById(targetId)
      if (!el || !bar.current) return
      const r = el.getBoundingClientRect()
      const total = r.height - window.innerHeight * 0.6
      const pct = total <= 0 ? 1 : Math.min(1, Math.max(0, -r.top / total))
      bar.current.style.transform = `scaleX(${pct})`
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(run) }
    run()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [targetId])
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] bg-transparent" aria-hidden>
      <div ref={bar} className="h-full origin-left bg-c-accent" style={{ transform: "scaleX(0)" }} />
    </div>
  )
}
