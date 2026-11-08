import Link from "next/link"
import type { ReactNode } from "react"

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g

/** Tiny inline formatter for post text: **bold**, `code` and [label](/path). */
export function Inline({ text }: { text: string }) {
  const out: ReactNode[] = text.split(TOKEN).map((part, i) => {
    if (part.startsWith("**")) return <strong key={i} className="font-semibold text-c-ink">{part.slice(2, -2)}</strong>
    if (part.startsWith("`")) return <code key={i} className="rounded bg-c-soft px-1.5 py-0.5 text-[0.9em] font-medium">{part.slice(1, -1)}</code>
    const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (m) return <Link key={i} href={m[2]} className="font-semibold text-c-brand underline decoration-2 underline-offset-4 hover:decoration-c-accent">{m[1]}</Link>
    return part
  })
  return <>{out}</>
}
