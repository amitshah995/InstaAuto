import { KeyRound, UserCheck } from "lucide-react"
import { SUPPORT_EMAIL } from "@/lib/site"
import { SectionHead, btnOutline, container } from "../ui"

export function Stories() {
  return (
    <section className="pt-[72px]" aria-labelledby="stories-h">
      <div className={container}>
        <SectionHead id="stories-h" title="Your story could be here" sub="We do not publish made-up reviews. Until customers share their own, here is what we promise." />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: KeyRound, k: "Our promise", t: "You write every message", b: "We send only what you wrote. Nothing is invented on your behalf." },
            { icon: UserCheck, k: "Our promise", t: "Only people who reached out", b: "DMs go to people who commented on your reel or messaged you first." },
          ].map((c) => (
            <figure key={c.t} className="rounded-xl border border-c-line bg-c-surface p-6">
              <c.icon className="h-7 w-7 text-c-brand" aria-hidden />
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-c-muted">{c.k}</p>
              <blockquote className="mt-1 font-display text-xl font-semibold leading-snug">{c.t}</blockquote>
              <figcaption className="mt-2 text-[15px] leading-relaxed text-c-muted">{c.b}</figcaption>
            </figure>
          ))}
          <div className="flex flex-col items-start justify-between rounded-xl border-2 border-dashed border-c-line bg-c-cream p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-c-muted">Placeholder</p>
              <p className="mt-1 font-display text-xl font-semibold leading-snug">Your story here</p>
              <p className="mt-2 text-[15px] leading-relaxed text-c-muted">Using Celra? Tell us how it went and we may feature it, with your say on every word.</p>
            </div>
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("My Celra story")}`} className={`${btnOutline} mt-5`}>Share your story</a>
          </div>
        </div>
      </div>
    </section>
  )
}
