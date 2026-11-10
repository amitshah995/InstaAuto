"use client"

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CardImageField } from "@/components/dashboard/CardImageField"
import { TrackedLinkPicker } from "@/components/dashboard/TrackedLinkPicker"
import type { ProButton } from "@/lib/types"
import { CARD_BUTTON_TITLE_MAX, CARD_MAX_BUTTONS, CARD_MAX_ELEMENTS, CARD_SUBTITLE_MAX, CARD_TITLE_MAX } from "@/lib/messaging/cards"

/**
 * Editor for one card or a carousel of up to 10 cards (add, remove, move up/down).
 *
 * Who uses it: components/dashboard/CreateRuleForm.tsx when the reply type is "Rich Card".
 * Why it exists: a rule can now send a carousel (several swipeable cards) instead of one card. With one card the saved
 * data is exactly the old single `card`, so nothing about existing rules changes. Limits are Meta's generic-template
 * limits (lib/messaging/cards.ts): 10 cards, title and subtitle 80 characters, 3 buttons per card.
 */
export interface CardDraft {
  id: string
  title: string
  subtitle: string
  image: string
  buttons: ProButton[]
}

export function newCardDraft(): CardDraft {
  return { id: `card_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title: "", subtitle: "", image: "", buttons: [] }
}

/** Draft -> stored card shape (same button cleaning the single card always had). */
export function cardDraftToContent(c: CardDraft) {
  const buttons = c.buttons
    .map((b) => {
      if (b.type === "web_url") {
        let url = b.url?.trim() || ""
        if (url.startsWith("https://https://")) url = url.replace("https://https://", "https://")
        return { type: "web_url", title: b.title, url }
      }
      // "Pay" button: the amount is typed in the shared value box. Razorpay creates the link at send time.
      if (b.type === "pay") return { type: "pay", title: b.title, amount_inr: Number(b.payload) || 0 }
      return { type: "postback", title: b.title, payload: b.payload }
    })
    .filter((b) => b.title)
  return { title: c.title, subtitle: c.subtitle || undefined, image_url: c.image || undefined, buttons }
}

export function CardCarouselEditor({ cards, onChange }: { cards: CardDraft[]; onChange: (c: CardDraft[]) => void }) {
  const patch = (id: string, p: Partial<CardDraft>) => onChange(cards.map((c) => (c.id === id ? { ...c, ...p } : c)))
  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= cards.length) return
    const next = cards.slice()
    ;[next[index], next[j]] = [next[j], next[index]]
    onChange(next)
  }
  const setButtons = (id: string, buttons: ProButton[]) => patch(id, { buttons })

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        One card, or up to {CARD_MAX_ELEMENTS} cards people can swipe through. Each card needs a title plus an image, subtitle or button. Instagram shows cards on the phone app, not on desktop.
      </p>
      {cards.map((card, index) => (
        <div key={card.id} className="space-y-3 p-3 rounded-xl border border-border bg-secondary/20 animate-in fade-in">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {cards.length > 1 ? `Card ${index + 1} of ${cards.length}` : "Card"}
            </span>
            {cards.length > 1 && (
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)} className="h-7 w-7" aria-label={`Move card ${index + 1} earlier`}>
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" disabled={index === cards.length - 1} onClick={() => move(index, 1)} className="h-7 w-7" aria-label={`Move card ${index + 1} later`}>
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => onChange(cards.filter((c) => c.id !== card.id))} className="h-7 w-7 text-destructive hover:bg-destructive/10" aria-label={`Remove card ${index + 1}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2 p-3 rounded-lg bg-background/60 border border-border">
            <Input
              value={card.title}
              maxLength={CARD_TITLE_MAX}
              onChange={(e) => patch(card.id, { title: e.target.value })}
              className="bg-background border-border font-bold text-foreground"
              placeholder="Card Title"
            />
            <Input
              value={card.subtitle}
              maxLength={CARD_SUBTITLE_MAX}
              onChange={(e) => patch(card.id, { subtitle: e.target.value })}
              className="bg-background border-border text-sm text-foreground"
              placeholder="Subtitle (Optional)"
            />
            <p className="text-[10px] text-muted-foreground text-right tabular-nums">
              title {card.title.length}/{CARD_TITLE_MAX} · subtitle {card.subtitle.length}/{CARD_SUBTITLE_MAX}
            </p>
            <CardImageField
              value={card.image}
              onChange={(v) => patch(card.id, { image: v })}
              linkUrl={card.buttons.find((b) => b.type === "web_url" && b.url?.trim())?.url || ""}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Buttons ({card.buttons.length}/{CARD_MAX_BUTTONS})</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => card.buttons.length < CARD_MAX_BUTTONS && setButtons(card.id, [...card.buttons, { id: Date.now().toString(), type: "web_url", title: "", url: "", payload: "" }])}
                disabled={card.buttons.length >= CARD_MAX_BUTTONS}
                className="h-7 text-xs hover:bg-secondary"
              >
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {card.buttons.map((btn) => {
              const upd = (field: keyof ProButton, value: string) => setButtons(card.id, card.buttons.map((b) => (b.id === btn.id ? { ...b, [field]: value } : b)))
              return (
                <div key={btn.id} className="space-y-1.5 bg-secondary/40 p-2 rounded-lg border border-border animate-in fade-in">
                  <div className="flex flex-wrap gap-2 items-center">
                    <Input
                      value={btn.title}
                      maxLength={CARD_BUTTON_TITLE_MAX}
                      onChange={(e) => upd("title", e.target.value)}
                      className="h-8 text-xs flex-1 min-w-[90px] bg-background border border-border px-2 text-foreground"
                      placeholder="Label"
                    />
                    <Select value={btn.type} onValueChange={(v) => upd("type", v)}>
                      <SelectTrigger className="h-8 w-[80px] text-[10px] bg-background border border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="web_url">Link</SelectItem>
                        <SelectItem value="postback">Flow</SelectItem>
                        <SelectItem value="pay">Pay</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={btn.type === "web_url" ? btn.url : btn.payload}
                      onChange={(e) => upd(btn.type === "web_url" ? "url" : "payload", e.target.value)}
                      className="h-8 text-xs flex-1 min-w-[110px] bg-background border border-border px-2 text-foreground"
                      placeholder={btn.type === "web_url" ? "https://..." : btn.type === "pay" ? "Amount in Rs, e.g. 499" : "Keyword"}
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => setButtons(card.id, card.buttons.filter((b) => b.id !== btn.id))} className="h-6 w-6 text-destructive hover:bg-destructive/10" aria-label="Remove button">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  {btn.type === "web_url" && <TrackedLinkPicker url={btn.url || ""} label={btn.title} onChange={(v) => upd("url", v)} />}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => cards.length < CARD_MAX_ELEMENTS && onChange([...cards, newCardDraft()])}
        disabled={cards.length >= CARD_MAX_ELEMENTS}
        className="w-full h-9 text-xs border border-dashed border-border hover:bg-secondary"
      >
        <Plus className="w-3.5 h-3.5 mr-1" /> Add another card ({cards.length}/{CARD_MAX_ELEMENTS})
      </Button>
    </div>
  )
}
