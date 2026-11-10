"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  QUICK_REPLY_MAX_COUNT,
  QUICK_REPLY_REPLY_MAX,
  QUICK_REPLY_TITLE_MAX,
  sanitizeQuickReplies,
  type QuickReply,
} from "@/lib/messaging/quick-replies"

/**
 * Editor for quick reply chips (tappable answers under a text DM).
 *
 * Who uses it: components/dashboard/CreateRuleForm.tsx (text message and each sequence message) and
 * app/dashboard/flow-builder/page.tsx (message node properties, with showReply=false because flows branch on
 * conditions instead of answering from the chip).
 * Why it exists: lets the owner offer "Price / Book / Talk to us" chips. Limits come from Meta: up to 13 chips,
 * titles up to 20 characters (lib/messaging/quick-replies.ts). Each chip gets a stable payload when it is added, which
 * Instagram sends back when the chip is tapped.
 */
export interface QuickReplyDraft {
  id: string
  title: string
  payload: string
  reply: string
}

export function newQuickReplyDraft(): QuickReplyDraft {
  const rnd = Math.random().toString(36).slice(2, 8)
  const id = `qr_${Date.now().toString(36)}${rnd}`
  return { id, title: "", payload: `QR_${id}`, reply: "" }
}

/** Draft rows -> the clean list stored on the rule (empty titles dropped, limits applied). */
export function quickRepliesToContent(drafts: QuickReplyDraft[], withReply: boolean): QuickReply[] {
  return sanitizeQuickReplies(drafts.map((d) => ({ title: d.title, payload: d.payload, reply: withReply ? d.reply : undefined })))
}

/** Stored list -> draft rows (for loading existing data into an editor). */
export function quickRepliesFromContent(list: unknown): QuickReplyDraft[] {
  return sanitizeQuickReplies(list).map((q, i) => ({ id: `qr_loaded_${i}_${q.payload}`, title: q.title, payload: q.payload, reply: q.reply || "" }))
}

export function QuickRepliesField({
  value,
  onChange,
  showReply = true,
  compact = false,
}: {
  value: QuickReplyDraft[]
  onChange: (v: QuickReplyDraft[]) => void
  /** Rules: each chip can answer on its own. Flow builder: false (conditions branch on the tapped chip instead). */
  showReply?: boolean
  compact?: boolean
}) {
  const update = (id: string, patch: Partial<QuickReplyDraft>) => onChange(value.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
          Quick replies ({value.length}/{QUICK_REPLY_MAX_COUNT})
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => value.length < QUICK_REPLY_MAX_COUNT && onChange([...value, newQuickReplyDraft()])}
          disabled={value.length >= QUICK_REPLY_MAX_COUNT}
          className="h-7 text-xs hover:bg-secondary"
        >
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
      </div>
      {value.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Optional. Chips people can tap instead of typing, for example &quot;Price&quot; or &quot;Book a call&quot;. They disappear once one is tapped.
        </p>
      )}
      {value.map((q) => (
        <div key={q.id} className={`rounded-lg border border-border bg-secondary/40 animate-in fade-in ${compact ? "p-2 space-y-1.5" : "p-2.5 space-y-2"}`}>
          <div className="flex items-center gap-2">
            <Input
              value={q.title}
              maxLength={QUICK_REPLY_TITLE_MAX}
              onChange={(e) => update(q.id, { title: e.target.value })}
              className="h-8 text-xs flex-1 bg-background border border-border px-2 text-foreground"
              placeholder="Chip label"
              aria-label="Quick reply label"
            />
            <span className="text-[10px] text-muted-foreground tabular-nums w-9 text-right">{q.title.length}/{QUICK_REPLY_TITLE_MAX}</span>
            <Button type="button" size="icon" variant="ghost" onClick={() => onChange(value.filter((x) => x.id !== q.id))} className="h-7 w-7 text-destructive hover:bg-destructive/10" aria-label="Remove quick reply">
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
          {showReply && (
            <Input
              value={q.reply}
              maxLength={QUICK_REPLY_REPLY_MAX}
              onChange={(e) => update(q.id, { reply: e.target.value })}
              className="h-8 text-xs bg-background border border-border px-2 text-foreground"
              placeholder="Reply to send when tapped (optional)"
              aria-label="Reply sent when this chip is tapped"
            />
          )}
        </div>
      ))}
      {value.length > 0 && (
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Labels are cut at {QUICK_REPLY_TITLE_MAX} characters by Instagram. Chips show on the phone app, not on desktop.
          {showReply ? " A chip without a reply is treated like the person typing its label." : " When a chip is tapped its label arrives as the person's reply, so a condition can branch on it."}
        </p>
      )}
    </div>
  )
}
