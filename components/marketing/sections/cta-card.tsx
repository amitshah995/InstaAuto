import { ArrowRight, Check } from "lucide-react"
import { INSTAGRAM_AUTH_URL } from "@/lib/instagram-auth"
import { btnPrimary, container } from "../ui"
import { SetupVisual } from "./visuals"

export function CtaCard({ title = "Start in 10 minutes", bullets = ["Connect your account with Instagram's own login", "Pick a template and change the words", "Switch it on and watch the replies go out"] }: { title?: string; bullets?: string[] }) {
  return (
    <section className="pt-[72px]" aria-labelledby="cta-h">
      <div className={container}>
        <div className="grid items-center gap-8 rounded-2xl bg-c-brand p-6 text-c-bg sm:p-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <h2 id="cta-h" className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h2>
            <ul className="mt-5 space-y-3">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-[15px] leading-relaxed">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-c-accent text-c-accent-ink" aria-hidden><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>{b}
                </li>
              ))}
            </ul>
            <a href={INSTAGRAM_AUTH_URL} className={`${btnPrimary} mt-7 !min-h-12 !px-7`}>Get started free <ArrowRight className="h-4 w-4" aria-hidden /></a>
          </div>
          <SetupVisual />
        </div>
      </div>
    </section>
  )
}
