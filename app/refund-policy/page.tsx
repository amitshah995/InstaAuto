/**
 * Refund and cancellation policy page (/refund-policy).
 * Linked from the billing page, the pricing page and the footer.
 * LEGAL REVIEW REQUIRED: this is plain-English draft text, not lawyer-approved. The periods and
 * amounts below are placeholders for the operator to confirm before billing is switched on.
 */
import type { Metadata } from "next"
import { PageShell } from "@/components/marketing/page-shell"
import { Pill, container } from "@/components/marketing/ui"
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/site"

export const metadata: Metadata = {
  title: "Refund and Cancellation Policy",
  description: `How cancellation and refunds work for paid ${BRAND_NAME} plans.`,
  alternates: { canonical: "/refund-policy" },
}

const sections: Array<{ h: string; p: string[] }> = [
  {
    h: "Free beta",
    p: [`While ${BRAND_NAME} is in free beta nothing is charged, so there is nothing to refund. This policy applies once paid plans are switched on.`],
  },
  {
    h: "Cancelling",
    p: [
      "You can cancel any time from Dashboard, Billing. Cancellation takes effect at the end of the period you already paid for. You keep your plan until that date and are not charged again.",
      "We do not charge a cancellation fee and we do not lock you in to a long contract. Plans renew monthly.",
    ],
  },
  {
    h: "Refunds",
    p: [
      "If you are charged by mistake, charged twice, or charged after a cancellation took effect, tell us and we will refund that charge in full.",
      "If you are unhappy with a new paid plan, ask for a refund within 7 days of your first payment and we will refund it, as long as you have not used a large share of the plan's DM allowance in that time.",
      "Renewals are generally not refunded for months already used, because the service has been delivered. We may make exceptions when something on our side stopped the service from working.",
    ],
  },
  {
    h: "How to ask and how long it takes",
    p: [
      `Email ${SUPPORT_EMAIL} from the address on your account with the date and amount of the charge. We aim to reply within 2 business days.`,
      "Approved refunds go back to the original payment method through Razorpay and usually reach your account in 5 to 7 business days, depending on your bank.",
    ],
  },
  {
    h: "Limits and Instagram changes",
    p: [
      "Plans include a set number of DMs per month. If you reach it, automatic DMs pause until the next month or until you upgrade. This is not a fault and is not refundable.",
      "Instagram and Meta set the rules for messaging and can change them. We cannot refund for changes made by Meta, but we will tell you if something affects your plan.",
    ],
  },
]

export default function RefundPolicyPage() {
  return (
    <PageShell>
      <section className="mx-auto w-full max-w-[760px] px-4 pt-[50px] sm:px-6">
        <Pill>Policy</Pill>
        <h1 className="mt-5 font-display text-[2.25rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl">Refund and cancellation policy</h1>
        <p className="mt-3 text-sm text-c-muted">Draft, last updated November 2026. This text needs legal review before paid plans go live.</p>
      </section>
      <section className={`${container} pt-10`}>
        <div className="mx-auto max-w-[760px] space-y-8">
          {sections.map((s) => (
            <div key={s.h}>
              <h2 className="font-display text-xl font-semibold">{s.h}</h2>
              {s.p.map((t) => (
                <p key={t} className="mt-2 text-[15px] leading-relaxed text-c-muted">{t}</p>
              ))}
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  )
}
