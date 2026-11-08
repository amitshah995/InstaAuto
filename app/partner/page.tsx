import type { Metadata } from "next"
import { ArrowRight, Briefcase, GraduationCap, Handshake } from "lucide-react"
import { PageShell } from "@/components/marketing/page-shell"
import { Pill, btnPrimary, container } from "@/components/marketing/ui"
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/site"

export const metadata: Metadata = {
  title: "Partner with us",
  description: `Agencies, educators and creators who want to work with ${BRAND_NAME}: tell us about yourself.`,
  alternates: { canonical: "/partner" },
  robots: { index: false, follow: true },
}

const WHO = [
  { icon: Briefcase, t: "Agencies", b: "Run automations for several clients from one place, with seats for your team." },
  { icon: GraduationCap, t: "Educators", b: "Teach Instagram growth? Share templates your students can use." },
  { icon: Handshake, t: "Creators", b: "Recommend a tool you use and trust, on terms we agree openly." },
]

export default function PartnerPage() {
  return (
    <PageShell>
      <section className="mx-auto w-full max-w-[900px] px-4 pt-[50px] text-center sm:px-6">
        <div className="flex justify-center gap-2"><Pill>Partner</Pill><span className="rounded-full bg-c-accent px-3 py-1 text-xs font-bold text-c-accent-ink">Interest list</span></div>
        <h1 className="mt-5 font-display text-[2.25rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl">Grow with {BRAND_NAME}</h1>
        <p className="mx-auto mt-4 max-w-[600px] text-base leading-relaxed text-c-muted sm:text-lg">We are shaping a partner program. Tell us who you are and we will write to you when it opens. No terms are set yet.</p>
        <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Partner program")}`} className={`${btnPrimary} mt-7 !min-h-12 !px-7`}>Tell us about you <ArrowRight className="h-4 w-4" aria-hidden /></a>
      </section>
      <section className={`${container} pt-[56px]`}>
        <ul className="grid gap-4 md:grid-cols-3">
          {WHO.map((w) => (
            <li key={w.t} className="rounded-xl border border-c-line bg-c-surface p-6">
              <w.icon className="h-7 w-7 text-c-brand" aria-hidden />
              <h2 className="mt-4 font-display text-xl font-semibold">{w.t}</h2>
              <p className="mt-1.5 text-[15px] leading-relaxed text-c-muted">{w.b}</p>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  )
}
