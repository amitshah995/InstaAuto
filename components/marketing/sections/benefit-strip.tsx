import { Marquee } from "../marquee"

const ITEMS = ["Free to start", "No setup fee", "Templates included", "Team seats", "Free audit tool", "Pause any time", "Official Instagram API"]

export function BenefitStrip() {
  return (
    <section className="mt-[72px] bg-c-brand py-4 text-c-bg" aria-label="Benefits">
      <Marquee label="Benefits" duration={32} reverse>
        {ITEMS.map((t) => (
          <span key={t} className="inline-flex shrink-0 items-center gap-4 font-display text-lg font-semibold">
            {t}<span className="h-2 w-2 rounded-full bg-c-accent" aria-hidden />
          </span>
        ))}
      </Marquee>
    </section>
  )
}
