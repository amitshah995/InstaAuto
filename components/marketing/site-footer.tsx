import Link from "next/link"
import { Linkedin, Mail, Twitter, Youtube } from "lucide-react"
import { CelraLogo } from "@/components/ui/celra-logo"
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/site"
import { FOOTER_COLUMNS } from "@/lib/marketing-nav"
import { focusRing } from "./ui"

/** Owner: replace these with the real profile links before launch. */
const SOCIAL = [
  { label: "YouTube", href: "https://www.youtube.com", icon: Youtube },
  { label: "LinkedIn", href: "https://www.linkedin.com", icon: Linkedin },
  { label: "X", href: "https://x.com", icon: Twitter },
]

const link = `inline-block rounded py-1 text-sm text-c-muted hover:text-c-ink hover:underline ${focusRing}`

export function SiteFooter() {
  return (
    <footer className="border-t border-c-line bg-c-bg text-c-ink">
      <div className="mx-auto grid max-w-[1600px] gap-10 px-4 py-12 min-[1000px]:px-[30px] lg:grid-cols-[minmax(0,1fr)_2fr]">
        <div className="max-w-sm">
          <CelraLogo variant="full" size={30} />
          <p className="mt-4 text-xs leading-relaxed text-c-muted">
            Not affiliated with or endorsed by Meta or Instagram. Instagram is a trademark of Meta Platforms, Inc.
          </p>
          <p className="mt-2 text-xs text-c-muted">© {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</p>
          <ul className="mt-4 flex items-center gap-1">
            {SOCIAL.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className={`grid h-10 w-10 place-items-center rounded-full text-c-muted hover:bg-c-soft hover:text-c-ink ${focusRing}`}>
                  <s.icon className="h-5 w-5" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 xl:grid-cols-5">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="font-display text-sm font-semibold">{col.title}</h2>
              <ul className="mt-3 space-y-1">
                {col.links.map((l) => <li key={l.href}><Link href={l.href} className={link}>{l.label}</Link></li>)}
              </ul>
            </div>
          ))}
          <div>
            <h2 className="font-display text-sm font-semibold">Contact</h2>
            <ul className="mt-3 space-y-1">
              <li><a href={`mailto:${SUPPORT_EMAIL}`} className={`${link} inline-flex items-start gap-2 break-all`}><Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{SUPPORT_EMAIL}</a></li>
              <li><Link href="/partner" className={link}>Become a partner</Link></li>
            </ul>
          </div>
        </nav>
      </div>
    </footer>
  )
}
