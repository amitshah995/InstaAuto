import { AlertTriangle, ChevronDown, Lightbulb, Lock } from "lucide-react"
import type { Block } from "@/lib/blog/types"
import { SampleTag } from "@/components/marketing/ui"
import { Checklist } from "./checklist"
import { Inline } from "./inline"

export function Callout({ kind, title, text }: { kind: "tip" | "warn"; title?: string; text: string }) {
  const tip = kind === "tip"
  const Icon = tip ? Lightbulb : AlertTriangle
  return (
    <aside aria-label={title ?? (tip ? "Pro tip" : "Watch out")} className={`my-8 rounded-r-xl border-l-4 p-5 ${tip ? "border-c-brand bg-c-brand-soft" : "border-c-accent bg-c-cream"}`}>
      <p className={`flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide ${tip ? "text-c-brand" : "text-c-ink"}`}>
        <Icon className={`h-4 w-4 ${tip ? "" : "text-c-accent"}`} aria-hidden />{title ?? (tip ? "Pro tip" : "Watch out")}
      </p>
      <p className="mt-2 text-base leading-relaxed"><Inline text={text} /></p>
    </aside>
  )
}

/** Drawn example: a public comment, then the private reply. All text is sample copy. */
export function DmExample({ comment, messages, caption, handle = "your_customer" }: { comment: string; messages: string[]; caption?: string; handle?: string }) {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border border-c-line bg-c-surface">
      <div className="flex items-center justify-between border-b border-c-line bg-c-soft px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-c-muted">Example: comment to DM</p>
        <SampleTag />
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <p className="flex items-start gap-2.5 text-sm">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-c-brand-soft text-xs font-bold text-c-brand" aria-hidden>{handle[0].toUpperCase()}</span>
          <span className="min-w-0 rounded-2xl rounded-tl-sm bg-c-soft px-3.5 py-2"><span className="font-semibold">{handle}</span> <span className="break-words">{comment}</span></span>
        </p>
        <div className="flex items-center gap-3 text-xs font-medium text-c-muted" aria-hidden><span className="h-px flex-1 bg-c-line" /><Lock className="h-3 w-3" />private reply from the business<span className="h-px flex-1 bg-c-line" /></div>
        {messages.map((m, i) => (
          <p key={i} className="ml-auto w-fit max-w-[88%] break-words rounded-2xl rounded-br-sm bg-c-brand px-3.5 py-2.5 text-sm leading-relaxed text-c-bg">{m}</p>
        ))}
      </div>
      {caption && <figcaption className="border-t border-c-line px-4 py-2.5 text-xs text-c-muted">{caption}</figcaption>}
    </figure>
  )
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="my-6 divide-y divide-c-line rounded-xl border border-c-line bg-c-surface">
      {items.map((it) => (
        <details key={it.q} className="group px-5 py-1">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded py-3 font-display text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-brand [&::-webkit-details-marker]:hidden">
            {it.q}<ChevronDown className="h-5 w-5 shrink-0 text-c-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
          </summary>
          <p className="pb-4 text-base leading-relaxed text-c-muted"><Inline text={it.a} /></p>
        </details>
      ))}
    </div>
  )
}

export function BlockView({ block, id }: { block: Block; id?: string }) {
  switch (block.t) {
    case "p":
      return <p className="my-5 text-[1.0625rem] leading-[1.8]"><Inline text={block.text} /></p>
    case "h3":
      return <h3 id={id} className="mb-2 mt-9 scroll-mt-28 font-display text-xl font-semibold leading-snug tracking-tight">{block.text}</h3>
    case "ul":
      return (
        <ul className="my-5 space-y-2.5 text-[1.0625rem] leading-[1.7]">
          {block.items.map((t) => <li key={t} className="relative pl-6 before:absolute before:left-1 before:top-[0.7em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-c-accent"><Inline text={t} /></li>)}
        </ul>
      )
    case "ol":
      return (
        <ol className="my-5 space-y-3 text-[1.0625rem] leading-[1.7] [counter-reset:step]">
          {block.items.map((t) => <li key={t} className="relative pl-10 [counter-increment:step] before:absolute before:left-0 before:top-0.5 before:grid before:h-7 before:w-7 before:place-items-center before:rounded-full before:bg-c-brand before:text-[13px] before:font-bold before:text-c-bg before:content-[counter(step)]"><Inline text={t} /></li>)}
        </ol>
      )
    case "callout":
      return <Callout kind={block.kind} title={block.title} text={block.text} />
    case "dm-example":
      return <DmExample comment={block.comment} messages={block.messages} caption={block.caption} handle={block.handle} />
    case "checklist":
      return <Checklist title={block.title} items={block.items} />
    case "faq":
      return <Faq items={block.items} />
  }
}
