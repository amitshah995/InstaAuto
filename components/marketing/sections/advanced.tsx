import type { ReactNode } from "react"
import { SectionHead, container } from "../ui"
import { FollowGateVisual, KeywordsVisual, ReportVisual, StoryVisual } from "./visuals"

const CARDS: { title: string; text: string; visual: ReactNode; cls: string }[] = [
  { title: "Keyword triggers", text: "Several words per automation, a different DM for each reel.", visual: <KeywordsVisual />, cls: "lg:col-span-2" },
  { title: "Story replies", text: "Answer the people who reply to your stories without opening the app.", visual: <StoryVisual />, cls: "lg:col-span-3" },
  { title: "Follow-gate", text: "Ask for a follow first, then send the link or the freebie.", visual: <FollowGateVisual />, cls: "lg:col-span-3" },
  { title: "Reports and funnel", text: "See how many comments became DMs, opens and clicks.", visual: <ReportVisual />, cls: "lg:col-span-2" },
]

export function Advanced() {
  return (
    <section className="pt-[72px]" aria-labelledby="adv-h">
      <div className={container}>
        <SectionHead id="adv-h" title="Advanced features that drive conversions" sub="Start simple, add more when you are ready." />
        <div className="mt-10 grid gap-4 lg:grid-cols-5">
          {CARDS.map((c) => (
            <article key={c.title} className={`flex flex-col overflow-hidden rounded-xl border border-c-line bg-c-surface ${c.cls}`}>
              <div className="p-6 pb-4">
                <h3 className="font-display text-xl font-semibold">{c.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-c-muted">{c.text}</p>
              </div>
              <div className="mx-6 mb-6 min-h-[190px] flex-1 overflow-hidden rounded-lg bg-c-soft">{c.visual}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
