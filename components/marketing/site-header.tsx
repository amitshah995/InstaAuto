"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Globe, Menu } from "lucide-react"
import { CelraLogo } from "@/components/ui/celra-logo"
import { BRAND_NAME } from "@/lib/site"
import { INSTAGRAM_AUTH_URL } from "@/lib/instagram-auth"
import { MENUS, TOP_LINKS, type NavItem } from "@/lib/marketing-nav"
import { MegaMenu } from "./mega-menu"
import { MobileDrawer } from "./mobile-drawer"
import { ThemeToggle } from "./theme-toggle"
import { btnOutline, btnPrimary, focusRing } from "./ui"

const linkCls = `flex h-10 items-center rounded-[5px] px-1.5 text-[14px] min-[1200px]:px-2.5 min-[1200px]:text-[15px] font-medium text-c-ink hover:bg-c-soft ${focusRing}`
const LANGUAGES: NavItem[] = [{ title: "English", sub: "Current language", icon: Globe, href: "#" }]

/** Fixed header, 65px tall. Hover dropdowns from 1000px up, a right-side drawer below that. */
export function SiteHeader() {
  const [drawer, setDrawer] = useState(false)
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-[65px] border-b border-c-line bg-c-surface text-c-ink">
        <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between gap-2 px-4 min-[1000px]:gap-4 min-[1000px]:px-[30px]">
          <Link href="/" aria-label={`${BRAND_NAME} home`} className={`flex shrink-0 items-center rounded-[5px] text-c-ink ${focusRing}`}>
            <CelraLogo variant="full" size={34} />
          </Link>

          <nav aria-label="Main" className="hidden flex-1 justify-center min-[1000px]:flex">
            <ul className="flex items-center gap-0 min-[1200px]:gap-1">
              <li><Link href={TOP_LINKS.pricing.href} className={linkCls}>{TOP_LINKS.pricing.label}</Link></li>
              {MENUS.map((m) => <MegaMenu key={m.key} label={m.label} items={m.items} />)}
              <li><Link href={TOP_LINKS.partner.href} className={linkCls}>{TOP_LINKS.partner.label}</Link></li>
              <MegaMenu label="Eng" icon={Globe} items={LANGUAGES} width={190} />
            </ul>
          </nav>

          <div className="hidden shrink-0 items-center gap-2 min-[1000px]:flex min-[1200px]:gap-3">
            <span className="hidden min-[1200px]:block"><ThemeToggle /></span>
            <a href={INSTAGRAM_AUTH_URL} className={`${btnPrimary} !min-h-10 !px-3 min-[1200px]:!px-5`}>Start for free <ArrowRight className="hidden h-4 w-4 min-[1200px]:block" aria-hidden /></a>
            <a href={INSTAGRAM_AUTH_URL} className={`${btnOutline} !min-h-10 !px-3 min-[1200px]:!px-5`}>Log in <ArrowRight className="hidden h-4 w-4 min-[1200px]:block" aria-hidden /></a>
          </div>

          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            aria-expanded={drawer}
            className={`grid h-11 w-11 cursor-pointer place-items-center rounded-[5px] hover:bg-c-soft min-[1000px]:hidden ${focusRing}`}
          >
            <Menu className="h-6 w-6" aria-hidden />
          </button>
        </div>
      </header>
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
    </>
  )
}
