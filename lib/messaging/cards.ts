/**
 * Cards and carousels (the Instagram "generic template").
 *
 * Who calls this: lib/messaging/send-steps.ts (turns a step into the Send API attachment), lib/automations/sanitize.ts
 * (clamps what the API stores), tests/batch1-cards.test.ts, and the carousel editor in components/dashboard.
 * Why it exists: a rule used to hold one card (`card`). A carousel is the same template with several `elements`, so a
 * rule now may hold `cards[]`. Old rules keep working: `normalizeCards` treats a lone `card` as a carousel of one, and
 * the editor also writes `card` (= first card) so older readers (previews, the Android app) still show something.
 *
 * Meta limits (checked 2026-11-10, "Send a Generic Template", Instagram API with Instagram Login):
 * https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/generic-template
 * - "A maximum of 10 elements is supported." title: 80 characters; subtitle: 80 characters (optional);
 *   "A maximum of 3 buttons per element"; only `postback` and `web_url` buttons; each element needs at least one
 *   property besides `title`; not available on desktop. The button title length is not stated; we cap it at 20, the
 *   Messenger limit, to be safe.
 * - The internal "pay" button is turned into a normal web_url button (a Payment Link) by send-steps before sending.
 */

export const CARD_MAX_ELEMENTS = 10
export const CARD_TITLE_MAX = 80
export const CARD_SUBTITLE_MAX = 80
export const CARD_MAX_BUTTONS = 3
export const CARD_BUTTON_TITLE_MAX = 20

export interface CardButton {
  type: "web_url" | "postback" | "pay"
  title: string
  url?: string
  payload?: string
  amount_inr?: number
  description?: string
}

export interface Card {
  title: string
  subtitle?: string
  image_url?: string
  buttons: CardButton[]
}

const cut = (s: string, max: number) => Array.from(s).slice(0, max).join("")

function cleanButton(raw: any): CardButton | null {
  if (!raw || typeof raw !== "object") return null
  const title = typeof raw.title === "string" ? cut(raw.title.trim(), CARD_BUTTON_TITLE_MAX).trim() : ""
  if (!title) return null
  if (raw.type === "web_url") {
    // url may be https://... or a tracked-link token like {link:abc123}, expanded at send time.
    const url = typeof raw.url === "string" ? raw.url.trim() : ""
    return url ? { type: "web_url", title, url } : null
  }
  if (raw.type === "pay") {
    const amount = Number(raw.amount_inr)
    const b: CardButton = { type: "pay", title, amount_inr: Number.isFinite(amount) ? amount : 0 }
    if (typeof raw.description === "string" && raw.description.trim()) b.description = raw.description.trim().slice(0, 200)
    return b
  }
  if (raw.type === "postback") {
    const payload = typeof raw.payload === "string" ? raw.payload.trim().slice(0, 1000) : ""
    return payload ? { type: "postback", title, payload } : null
  }
  return null // Instagram supports no other button types in the generic template
}

/** Cleans one card to Meta's limits. Returns null when it has no title. */
export function sanitizeCard(raw: unknown): Card | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as any
  const title = typeof r.title === "string" ? cut(r.title.trim(), CARD_TITLE_MAX).trim() : ""
  if (!title) return null
  const card: Card = { title, buttons: [] }
  const subtitle = typeof r.subtitle === "string" ? cut(r.subtitle.trim(), CARD_SUBTITLE_MAX).trim() : ""
  if (subtitle) card.subtitle = subtitle
  if (typeof r.image_url === "string" && /^https?:\/\//i.test(r.image_url.trim())) card.image_url = r.image_url.trim()
  if (Array.isArray(r.buttons)) {
    for (const b of r.buttons) {
      const cb = cleanButton(b)
      if (cb) card.buttons.push(cb)
      if (card.buttons.length >= CARD_MAX_BUTTONS) break
    }
  }
  return card
}

/**
 * The cards of a step or of a rule's response_content, as a clean list of at most 10.
 * `cards` wins when present and non-empty; otherwise a legacy `card` becomes a list of one. Never throws.
 */
export function normalizeCards(source: unknown): Card[] {
  const s = source as { cards?: unknown; card?: unknown } | null
  const out: Card[] = []
  const list = Array.isArray(s?.cards) && s!.cards.length > 0 ? (s!.cards as unknown[]) : s?.card ? [s.card] : []
  for (const raw of list) {
    const c = sanitizeCard(raw)
    if (c) out.push(c)
    if (out.length >= CARD_MAX_ELEMENTS) break
  }
  return out
}

/** Meta: every element needs the title plus at least one more property (subtitle, image or buttons). */
export function isSendableElement(card: Card): boolean {
  return !!card.title && (!!card.subtitle || !!card.image_url || card.buttons.length > 0)
}

/** One generic-template element from a card whose buttons are already resolved to web_url/postback only. */
export function toGraphElement(card: Card, buttons: { type: "web_url" | "postback"; title: string; url?: string; payload?: string }[]) {
  const element: Record<string, unknown> = { title: card.title }
  if (card.subtitle) element.subtitle = card.subtitle
  if (card.image_url) element.image_url = card.image_url
  if (buttons.length > 0) {
    element.buttons = buttons.map((b) => (b.type === "web_url" ? { type: "web_url", title: b.title, url: b.url } : { type: "postback", title: b.title, payload: b.payload }))
  }
  return element
}

/** The `message` object for the Send API: a generic template with 1..10 elements. */
export function toGenericTemplateMessage(elements: Record<string, unknown>[]) {
  return {
    attachment: {
      type: "template",
      payload: { template_type: "generic", elements: elements.slice(0, CARD_MAX_ELEMENTS) },
    },
  }
}

/** Short text for logs and the inbox ("[Card] Title" for one, "[Carousel] 3 cards: A, B, C" for several). */
export function describeCards(cards: Card[]): string {
  if (cards.length <= 1) return `[Card] ${cards[0]?.title ?? ""}`
  return `[Carousel] ${cards.length} cards: ${cards.map((c) => c.title).join(", ")}`.slice(0, 300)
}
