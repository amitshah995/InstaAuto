"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  DEFAULT_PUBLIC_REPLIES,
  MAX_PUBLIC_REPLY_LENGTH,
  MAX_PUBLIC_REPLY_VARIANTS,
  fillPlaceholders,
} from "@/lib/automations/public-reply"

/**
 * Editor for the public comment reply of a comment rule ("Check your DMs!").
 *
 * Who uses it: components/dashboard/CreateRuleForm.tsx (step 3, comment rules only).
 * Why it exists: the public reply used to be three fixed phrases. This lets the owner turn it off or write up to
 * MAX_PUBLIC_REPLY_VARIANTS variants (150 characters each). The webhook rotates them at random, because Instagram can
 * treat many identical replies as spam. State lives in the form; the value saved is response_content.public_reply.
 */
export interface PublicReplyDraft {
  enabled: boolean
  variants: { id: string; text: string }[]
}

export function defaultPublicReplyDraft(): PublicReplyDraft {
  return { enabled: true, variants: DEFAULT_PUBLIC_REPLIES.map((text, i) => ({ id: `pr${i}`, text })) }
}

/** Shape stored on the rule. */
export function publicReplyToContent(d: PublicReplyDraft) {
  return { enabled: d.enabled, variants: d.variants.map((v) => v.text) }
}

export function PublicReplyField({ value, onChange }: { value: PublicReplyDraft; onChange: (v: PublicReplyDraft) => void }) {
  const setText = (id: string, text: string) =>
    onChange({ ...value, variants: value.variants.map((v) => (v.id === id ? { ...v, text: text.slice(0, MAX_PUBLIC_REPLY_LENGTH) } : v)) })
  const add = () => {
    if (value.variants.length >= MAX_PUBLIC_REPLY_VARIANTS) return
    onChange({ ...value, variants: [...value.variants, { id: `pr${Date.now()}`, text: "" }] })
  }
  const remove = (id: string) => onChange({ ...value, variants: value.variants.filter((v) => v.id !== id) })
  const filled = value.variants.filter((v) => v.text.trim()).length
  const sample = value.variants.find((v) => v.text.trim())?.text
  const preview = sample ? fillPlaceholders(sample, { username: "priya.codes", firstName: "Priya" }) : null

  return (
    <div className="p-4 rounded-xl border border-border space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">Public reply under the comment</p>
          <p className="text-[11px] text-muted-foreground">
            A short reply posted publicly under the comment, next to the DM. Turn it off if you only want the DM.
          </p>
        </div>
        <Switch checked={value.enabled} onCheckedChange={(enabled) => onChange({ ...value, enabled })} aria-label="Send a public reply" />
      </div>

      {value.enabled && (
        <div className="space-y-2">
          <Label className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
            Reply variants ({value.variants.length}/{MAX_PUBLIC_REPLY_VARIANTS})
          </Label>
          {value.variants.map((v) => (
            <div key={v.id} className="flex items-center gap-2">
              <Input
                value={v.text}
                maxLength={MAX_PUBLIC_REPLY_LENGTH}
                onChange={(e) => setText(v.id, e.target.value)}
                className="h-9 text-sm bg-background border-border"
                placeholder="e.g. Sent, {first_name}! Check your DMs"
                aria-label="Public reply variant"
              />
              <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">{v.text.length}/{MAX_PUBLIC_REPLY_LENGTH}</span>
              <Button type="button" size="icon" variant="ghost" onClick={() => remove(v.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10" aria-label="Remove variant">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={add}
            disabled={value.variants.length >= MAX_PUBLIC_REPLY_VARIANTS}
            className="w-full h-9 text-xs border border-dashed border-border hover:bg-secondary"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add a variant
          </Button>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            We pick one at random for each comment. Instagram can treat many identical replies as spam, so write at least 3 different
            ones. Use <code className="font-mono">{"{first_name}"}</code> (their saved name, otherwise their username) and{" "}
            <code className="font-mono">{"{username}"}</code> (shown as a mention).
          </p>
          {filled < 3 && (
            <p className="text-[11px] text-warn font-semibold">Tip: only {filled} reply variant{filled === 1 ? "" : "s"}. Add more so the replies do not look copied.</p>
          )}
          {filled === 0 && (
            <p className="text-[11px] text-muted-foreground">With no text we use our default short replies.</p>
          )}
          {preview && (
            <p className="text-[11px] text-muted-foreground">
              Example: <span className="text-foreground font-semibold">{preview}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
