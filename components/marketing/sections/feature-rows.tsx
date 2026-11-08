import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowRight } from "lucide-react"
import { CheckList, SectionHead, btnOutline, container } from "../ui"
import { CommentThread, DmCard, FlowVisual, InboxVisual } from "./visuals"

const ROWS: { id: string; title: string; text: string; bullets: string[]; cta: [string, string]; visual: ReactNode }[] = [
  {
    id: "r1", title: "Reply to every comment, instantly", cta: ["Explore comment-to-DM", "/product/comment-to-dm"],
    text: "Pick a reel and a word. When someone comments it, they get your DM with the price, link or details.",
    bullets: ["Choose the reels and words that matter", "Write the DM once, send it every time", "Pause or edit any automation in a click"],
    visual: <div className="grid gap-3 rounded-2xl border border-c-line bg-c-soft p-4 sm:grid-cols-2"><CommentThread /><DmCard /></div>,
  },
  {
    id: "r2", title: "Build whole conversations with flows", cta: ["Explore DM flows", "/product/dm-flows"],
    text: "Ask a question, offer buttons, branch on the answer. Test it on a phone preview before it goes live.",
    bullets: ["Visual builder, no code", "Start from a ready template", "Version history to go back"],
    visual: <FlowVisual />,
  },
  {
    id: "r3", title: "One inbox for your team, from chat to order", cta: ["Explore the inbox", "/product/smart-inbox"],
    text: "Automations handle the repeat questions. Your team picks up the rest, tags contacts and follows each lead to the order.",
    bullets: ["Shared inbox with full threads", "Contacts, tags and notes", "Payment and booking templates"],
    visual: <InboxVisual />,
  },
]

export function FeatureRows() {
  return (
    <section className="pt-[72px]" aria-labelledby="rows-h">
      <div className={container}>
        <SectionHead id="rows-h" title="From the first comment to the finished order" sub="Everything you need to turn Instagram attention into conversations." />
        <div className="mt-12 space-y-16 sm:space-y-20">
          {ROWS.map((r, i) => (
            <div key={r.id} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <div className={i % 2 ? "lg:order-2" : ""}>
                <h3 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">{r.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-c-muted">{r.text}</p>
                <div className="mt-5"><CheckList items={r.bullets} /></div>
                <Link href={r.cta[1]} className={`${btnOutline} mt-7`}>{r.cta[0]} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              </div>
              <div className={i % 2 ? "lg:order-1" : ""}>{r.visual}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
