import type { ReactNode } from "react"
import { Check } from "lucide-react"

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-brand focus-visible:ring-offset-2 focus-visible:ring-offset-c-bg"

const btnBase = `inline-flex min-h-11 items-center justify-center gap-2 rounded-[5px] px-5 text-[15px] font-semibold transition-colors cursor-pointer ${focusRing}`
/** Coral button, dark ink text. */
export const btnPrimary = `${btnBase} bg-c-accent text-c-accent-ink border-2 border-c-accent hover:brightness-95`
/** Outlined button, 2px ink border, 5px radius. */
export const btnOutline = `${btnBase} border-2 border-c-ink text-c-ink bg-transparent hover:bg-c-soft`

export const container = "mx-auto w-full max-w-[1200px] px-4 sm:px-6"

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-c-line bg-c-surface px-3 py-1 text-xs font-medium text-c-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-c-accent" aria-hidden />
      {children}
    </span>
  )
}

export function SectionHead({ title, sub, id, align = "center" }: { title: string; sub?: string; id?: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <h2 id={id} className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-base leading-relaxed text-c-muted sm:text-lg">{sub}</p>}
    </div>
  )
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-3 text-[15px] leading-relaxed">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-c-brand-soft text-c-brand" aria-hidden>
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          {t}
        </li>
      ))}
    </ul>
  )
}

/** Marks drawn sample content so nobody mistakes it for real data. */
export function SampleTag({ children = "Sample" }: { children?: string }) {
  return <span className="rounded-full bg-c-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-c-muted">{children}</span>
}
