import { Cake, Camera, Dumbbell, GraduationCap, Home, Palette, Scissors, Shirt, Sparkles, Store, Plane, Briefcase, Coffee } from "lucide-react"
import { Marquee } from "../marquee"
import { SectionHead } from "../ui"

const CHIPS = [
  [Cake, "Home bakery"], [Dumbbell, "Fitness coach"], [Shirt, "Fashion label"], [Camera, "Photographer"],
  [Sparkles, "Skincare brand"], [GraduationCap, "Course creator"], [Coffee, "Neighbourhood cafe"], [Scissors, "Hair salon"],
  [Plane, "Travel blogger"], [Home, "Property agent"], [Briefcase, "Social agency"], [Palette, "Artist"], [Store, "Local shop"],
] as const

export function SocialProof() {
  return (
    <section className="pt-[72px]" aria-labelledby="proof-h">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <SectionHead id="proof-h" title="Creators & brands love us" sub="Built for every kind of account that gets questions in the comments." />
      </div>
      <div className="mt-8"><Marquee label="Kinds of accounts Celra is built for" duration={45}>
        {CHIPS.map(([Icon, label]) => (
          <span key={label} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-c-line bg-c-surface px-5 py-3 font-display text-base font-semibold text-c-muted">
            <Icon className="h-5 w-5 text-c-brand" aria-hidden /> {label}
          </span>
        ))}
      </Marquee></div>
      <p className="mt-4 text-center text-xs text-c-muted">Sample categories to show who it is for. These are not customers.</p>
    </section>
  )
}
