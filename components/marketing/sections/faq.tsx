import { Plus } from "lucide-react"
import { FAQS } from "@/lib/marketing-faq"
import { SectionHead, focusRing } from "../ui"

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 pt-[72px]" aria-labelledby="faq-h">
      <div className="mx-auto max-w-[900px] px-4 sm:px-6">
        <SectionHead id="faq-h" title="Frequently asked questions" />
        <div className="mt-8 divide-y divide-c-line rounded-xl border border-c-line bg-c-surface px-5 sm:px-8">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-1">
              <summary className={`flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded py-3 font-display text-lg font-medium [&::-webkit-details-marker]:hidden ${focusRing}`}>
                {f.q}
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-c-soft text-c-brand transition-transform group-open:rotate-45" aria-hidden><Plus className="h-4 w-4" /></span>
              </summary>
              <p className="pb-4 pr-10 leading-relaxed text-c-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
