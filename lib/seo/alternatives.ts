import { BRAND_NAME } from "@/lib/site"
/**
 * Honest "alternative" pages. Rules for editing this file:
 *  - Only claim things Celra really does.
 *  - Never state a competitor's price, user count or limits (they change) — tell readers to check.
 *  - No invented testimonials or numbers.
 */
export interface AltPage {
  slug: string
  competitor: string
  title: string
  description: string
  intro: string
  whyLook: string[]
  fits: string[]
  comparison: { feature: string; celra: string; note?: string }[]
  notFor: string[]
}

const COMMON_COMPARISON = [
  { feature: "Comment → DM automation (keyword or every comment)", celra: "Yes — per post or account-wide" },
  { feature: "Reply to the comment publicly as well", celra: "Yes" },
  { feature: "Rich card DM with up to 3 buttons", celra: "Yes" },
  { feature: "Click tracking on every button link", celra: "Yes — each link is counted separately" },
  { feature: "Multi-step flows and lead questions", celra: "Yes — flow builder with ready templates" },
  { feature: "Contacts list with CSV export", celra: "Yes" },
  { feature: "Link-in-bio style shop page with price and discount", celra: "Yes — built in" },
  { feature: "Shareable read-only client report", celra: "Yes" },
  { feature: "Works on WhatsApp / Messenger / TikTok", celra: "Instagram only (a WhatsApp area exists separately)" },
]

const NOT_FOR_COMMON = [
  "You need Facebook Messenger, WhatsApp or TikTok automation in one tool.",
  "You need a large visual flow canvas with dozens of channels and integrations.",
  "You need a team seat system with roles today — we're still building that.",
]

export const ALT_PAGES: AltPage[] = [
  {
    slug: "manychat-alternative",
    competitor: "ManyChat",
    title: "A simpler ManyChat alternative for Instagram comment-to-DM",
    description: `${BRAND_NAME} is an Instagram-only ManyChat alternative: comment → DM automation, tracked links, lead capture and a shop page, without the multi-channel complexity.`,
    intro: `ManyChat is a broad, multi-channel chatbot platform. If all you want is to answer Instagram comments and send DMs with links, a focused tool can be quicker to set up. That is what ${BRAND_NAME} is.`,
    whyLook: [
      "You only sell or post on Instagram and don't need other channels.",
      "You want a setup that takes minutes, not a flow canvas to learn.",
      "You want click tracking and a shop page without adding more tools.",
    ],
    fits: ["Creators and small shops selling through Instagram", "Agencies who send clients a simple report link", "Anyone who wants 'comment a keyword, get the link in DM' working today"],
    comparison: COMMON_COMPARISON,
    notFor: NOT_FOR_COMMON,
  },
  {
    slug: "chatfuel-alternative",
    competitor: "Chatfuel",
    title: "A focused Chatfuel alternative for Instagram automation",
    description: `Looking for a Chatfuel alternative just for Instagram? ${BRAND_NAME} automates comments and DMs, tracks link clicks and captures leads.`,
    intro: `Chatfuel is a general chatbot builder. ${BRAND_NAME} does one thing — Instagram comment and DM automation — and adds the pieces creators ask for next: tracked links, a shop page and shareable reports.`,
    whyLook: [
      "You want Instagram-specific features rather than a general bot builder.",
      "You want to see which button in a DM actually got clicks.",
      "You want to hand a client a simple results page.",
    ],
    fits: ["Instagram-first creators and brands", "Small agencies running a few client accounts", "People who prefer ready templates over building from scratch"],
    comparison: COMMON_COMPARISON,
    notFor: NOT_FOR_COMMON,
  },
  {
    slug: "linkdm-alternative",
    competitor: "LinkDM",
    title: "A LinkDM alternative with a shop page and click tracking",
    description: `${BRAND_NAME} covers the 'comment a word, get the link' flow like LinkDM, plus tracked links, flows, contacts export and a built-in shop page.`,
    intro: `LinkDM-style tools send a link when someone comments a keyword. ${BRAND_NAME} does that too, and goes further with multi-step flows, tracked buttons, a contacts list and a link-in-bio style shop with prices.`,
    whyLook: [
      "You want more than a single link per DM — up to three tracked buttons.",
      "You want leads saved to a contacts list you can export.",
      "You want your affiliate and product links in one shop page.",
    ],
    fits: ["Affiliate and product creators", "Coaches who collect a phone or email in DM", "Anyone outgrowing a single-link tool"],
    comparison: COMMON_COMPARISON,
    notFor: NOT_FOR_COMMON,
  },
]

export const getAltPage = (slug: string) => ALT_PAGES.find((p) => p.slug === slug)
