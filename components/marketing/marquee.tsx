import type { ReactNode } from "react"

/** CSS-only infinite scroller. Children are repeated once (the copy is hidden from assistive tech). Pauses on hover. */
export function Marquee({ children, duration = 40, reverse = false, label }: { children: ReactNode; duration?: number; reverse?: boolean; label: string }) {
  return (
    <div className="celra-marquee-wrap overflow-hidden" role="group" aria-label={label}>
      <div className={`celra-marquee ${reverse ? "celra-marquee-rev" : ""}`} style={{ ["--dur" as string]: `${duration}s` }}>
        <div className="flex shrink-0 items-center gap-4 pr-4">{children}</div>
        <div className="celra-marquee-dup flex shrink-0 items-center gap-4 pr-4" aria-hidden>{children}</div>
      </div>
    </div>
  )
}
