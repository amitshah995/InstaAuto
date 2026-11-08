import { PageShell } from "@/components/marketing/page-shell"
import { Hero } from "@/components/marketing/sections/hero"
import { SocialProof } from "@/components/marketing/sections/social-proof"
import { ProductTour } from "@/components/marketing/sections/product-tour"
import { Signup } from "@/components/marketing/sections/signup"
import { FeatureRows } from "@/components/marketing/sections/feature-rows"
import { Stats } from "@/components/marketing/sections/stats"
import { Advanced } from "@/components/marketing/sections/advanced"
import { BenefitStrip } from "@/components/marketing/sections/benefit-strip"
import { Stories } from "@/components/marketing/sections/stories"
import { CtaCard } from "@/components/marketing/sections/cta-card"
import { Faq } from "@/components/marketing/sections/faq"

/** Marketing home page. Each block lives in components/marketing/sections. */
export function GoogleSearchHome() {
  return (
    <PageShell>
      <Hero />
      <SocialProof />
      <ProductTour />
      <Signup />
      <FeatureRows />
      <Stats />
      <Advanced />
      <BenefitStrip />
      <Stories />
      <CtaCard />
      <Faq />
    </PageShell>
  )
}
