// Unit tests for cards / carousel payload building (pure, no network).
import test from "node:test"
import assert from "node:assert/strict"
import {
  CARD_BUTTON_TITLE_MAX,
  CARD_MAX_BUTTONS,
  CARD_MAX_ELEMENTS,
  CARD_SUBTITLE_MAX,
  CARD_TITLE_MAX,
  describeCards,
  isSendableElement,
  normalizeCards,
  sanitizeCard,
  toGenericTemplateMessage,
  toGraphElement,
} from "../lib/messaging/cards.ts"
import { sanitizeResponseContent } from "../lib/automations/sanitize.ts"

const card = (n: number) => ({ title: `Card ${n}`, subtitle: `Sub ${n}`, image_url: "https://example.com/a.jpg", buttons: [{ type: "web_url", title: "Buy", url: "https://example.com" }] })

test("legacy single card becomes a carousel of one (backward compatible)", () => {
  const out = normalizeCards({ card: card(1) })
  assert.equal(out.length, 1)
  assert.equal(out[0].title, "Card 1")
  assert.deepEqual(normalizeCards({ message: "plain text rule" }), [])
  assert.deepEqual(normalizeCards(null), [])
})

test("cards[] wins over card, capped at 10 elements", () => {
  const cards = Array.from({ length: 14 }, (_, i) => card(i))
  const out = normalizeCards({ card: card(99), cards })
  assert.equal(out.length, CARD_MAX_ELEMENTS)
  assert.equal(out[0].title, "Card 0")
  assert.equal(normalizeCards({ card: card(5), cards: [] })[0].title, "Card 5") // empty cards[] falls back to card
})

test("sanitizeCard clamps title, subtitle, button count and button titles to Meta limits", () => {
  const c = sanitizeCard({
    title: "T".repeat(200),
    subtitle: "S".repeat(200),
    image_url: "ftp://nope",
    buttons: [1, 2, 3, 4, 5].map((i) => ({ type: "web_url", title: "B".repeat(50), url: `https://e.com/${i}` })),
  })!
  assert.equal(Array.from(c.title).length, CARD_TITLE_MAX)
  assert.equal(Array.from(c.subtitle!).length, CARD_SUBTITLE_MAX)
  assert.equal(c.image_url, undefined)
  assert.equal(c.buttons.length, CARD_MAX_BUTTONS)
  assert.equal(Array.from(c.buttons[0].title).length, CARD_BUTTON_TITLE_MAX)
})

test("sanitizeCard drops cards without title and unsupported/empty buttons", () => {
  assert.equal(sanitizeCard({ title: "   " }), null)
  assert.equal(sanitizeCard("x"), null)
  const c = sanitizeCard({
    title: "Hi",
    buttons: [
      { type: "phone_number", title: "Call", payload: "+1" },
      { type: "web_url", title: "No url" },
      { type: "postback", title: "Go", payload: "GO" },
      { type: "pay", title: "Pay", amount_inr: 499 },
    ],
  })!
  assert.deepEqual(c.buttons.map((b) => b.type), ["postback", "pay"])
})

test("isSendableElement needs a title plus one more property", () => {
  assert.equal(isSendableElement({ title: "Only title", buttons: [] }), false)
  assert.equal(isSendableElement({ title: "t", subtitle: "s", buttons: [] }), true)
  assert.equal(isSendableElement({ title: "t", image_url: "https://x", buttons: [] }), true)
  assert.equal(isSendableElement({ title: "t", buttons: [{ type: "postback", title: "a", payload: "p" }] }), true)
})

test("generic template body has the shape the Send API expects", () => {
  const c1 = sanitizeCard(card(1))!
  const el = toGraphElement(c1, [{ type: "web_url", title: "Buy", url: "https://example.com" }])
  assert.deepEqual(el, {
    title: "Card 1",
    subtitle: "Sub 1",
    image_url: "https://example.com/a.jpg",
    buttons: [{ type: "web_url", title: "Buy", url: "https://example.com" }],
  })
  const body = toGenericTemplateMessage(Array.from({ length: 12 }, () => el))
  assert.equal(body.attachment.type, "template")
  assert.equal(body.attachment.payload.template_type, "generic")
  assert.equal(body.attachment.payload.elements.length, 10)
})

test("toGraphElement omits empty optional fields and empty buttons", () => {
  assert.deepEqual(toGraphElement({ title: "T", subtitle: "s", buttons: [] }, []), { title: "T", subtitle: "s" })
})

test("describeCards keeps the old single-card log text", () => {
  assert.equal(describeCards([{ title: "Hello", buttons: [] }]), "[Card] Hello")
  assert.equal(describeCards([{ title: "A", buttons: [] }, { title: "B", buttons: [] }]), "[Carousel] 2 cards: A, B")
})

test("sanitizeResponseContent mirrors the first card into card and leaves single-card rules alone", () => {
  const out = sanitizeResponseContent({ cards: [card(1), card(2)] })
  assert.equal(out.cards.length, 2)
  assert.equal(out.card.title, "Card 1")
  const legacy = { card: { title: "Long title ".repeat(20), buttons: [] } }
  assert.deepEqual(sanitizeResponseContent(legacy), legacy) // a stored single card is not rewritten
  assert.equal("cards" in sanitizeResponseContent({ message: "x", cards: [{ title: "" }] }), false)
})
