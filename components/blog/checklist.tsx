"use client"

import { useId, useState } from "react"
import { Check } from "lucide-react"

/** Tick-off list. Nothing is saved; it is just handy while you work through it. */
export function Checklist({ title, items }: { title: string; items: string[] }) {
  const uid = useId()
  const [done, setDone] = useState<Record<number, boolean>>({})
  const n = Object.values(done).filter(Boolean).length
  return (
    <fieldset className="my-8 rounded-xl border border-c-line bg-c-surface p-5">
      <legend className="float-left mb-3 w-full font-display text-lg font-semibold">{title}</legend>
      <p className="clear-both mb-3 text-xs text-c-muted" aria-live="polite">{n} of {items.length} done</p>
      <ul className="space-y-1">
        {items.map((t, i) => (
          <li key={t}>
            <label htmlFor={`${uid}-${i}`} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-c-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-c-brand">
              <input id={`${uid}-${i}`} type="checkbox" checked={!!done[i]} onChange={(e) => setDone({ ...done, [i]: e.target.checked })} className="peer sr-only" />
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border-2 border-c-brand text-c-bg peer-checked:bg-c-brand" aria-hidden><Check className={`h-3.5 w-3.5 ${done[i] ? "opacity-100" : "opacity-0"}`} strokeWidth={3} /></span>
              <span className={`text-base leading-snug ${done[i] ? "text-c-muted line-through decoration-c-muted/60" : ""}`}>{t}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
