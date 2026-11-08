import type { ReactNode } from "react"
import { AnnouncementStrip } from "./announcement-strip"
import { PromoPopup } from "./promo-popup"
import { SiteFooter } from "./site-footer"
import { SiteHeader } from "./site-header"
import { focusRing } from "./ui"

/** Header + announcement strip + content + footer + popups. Every marketing page is wrapped in this. */
export function PageShell({ children, strip = true }: { children: ReactNode; strip?: boolean }) {
  return (
    <div className="celra-landing min-h-screen w-full overflow-x-clip bg-c-bg text-c-ink">
      <a href="#main" className={`sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-[5px] focus:bg-c-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold ${focusRing}`}>Skip to content</a>
      <SiteHeader />
      <div className="h-[65px]" aria-hidden />
      {strip && <AnnouncementStrip />}
      <main id="main" className="pb-[72px]">{children}</main>
      <SiteFooter />
      <PromoPopup />
    </div>
  )
}
