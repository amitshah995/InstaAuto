"use client"

import { useState } from "react"
import { Check, Copy, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import QrCode from "@/components/links/QrCode"
import { REF_CODE_MAX, buildRefLink, isValidRefCode, normalizeRefCode, suggestRefCode } from "@/lib/automations/referral"

/**
 * Code input + shareable link + QR code for a "start from a link or QR code" rule.
 *
 * Who uses it: components/dashboard/CreateRuleForm.tsx (DM rules, step 1) and components/dashboard/AutomationList.tsx
 * (shows the same link and QR for an existing ref rule).
 * Why it exists: Instagram opens a chat with a code (ig.me/m/<username>?ref=<code>) when someone taps the link or scans
 * the QR. The webhook reads that code and runs the matching rule, and the contact is tagged with where they came from.
 * The QR is drawn in the browser with the existing qrcode-generator dependency (components/links/QrCode.tsx).
 */
export function RefLinkField({
  username,
  code,
  onChange,
  nameHint,
  readOnly,
}: {
  username?: string | null
  code: string
  onChange: (code: string) => void
  /** Rule name used to suggest a readable code. */
  nameHint?: string
  /** Show only the link and QR (rules list); the code itself is edited when the rule is created. */
  readOnly?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const valid = isValidRefCode(code)
  const link = valid ? buildRefLink(username, code) : null

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked: the link is also shown in the field below so it can be selected by hand
    }
  }

  return (
    <div className="space-y-3">
      {!readOnly && <div className="space-y-1.5">
        <Label className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider ml-1">Link code</Label>
        <div className="flex items-center gap-2">
          <Input
            value={code}
            maxLength={REF_CODE_MAX}
            onChange={(e) => onChange(normalizeRefCode(e.target.value))}
            placeholder="e.g. summer-sale"
            className="bg-secondary/30 border-border font-mono text-sm"
            aria-label="Link code"
            aria-invalid={code.length > 0 && !valid}
          />
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(suggestRefCode(nameHint || ""))} className="h-9 w-9 shrink-0" aria-label="Suggest a code" title="Suggest a code">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground ml-1">Lowercase letters, numbers, - and _ only. Each code can start one automation.</p>
        {code.length > 0 && !valid && <p className="text-[11px] text-destructive font-semibold ml-1">Use only lowercase letters, numbers, - and _.</p>}
      </div>}

      {valid && !link && (
        <p className="text-[11px] text-warn font-semibold ml-1">We could not read your Instagram username yet, so the link is not ready. Reload the page and try again.</p>
      )}

      {link && (
        <div className="p-3 rounded-xl border border-border bg-secondary/20 space-y-3">
          <div className="flex items-center gap-2">
            <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="bg-background border-border text-xs font-mono" aria-label="Your link" />
            <Button type="button" size="sm" onClick={copy} className="shrink-0 bg-foreground text-background hover:bg-foreground/90 font-bold">
              {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <QrCode
            value={link}
            handle={username || "account"}
            fileLabel={code}
            caption="Print it or show it on screen. Scanning it opens a chat with you and starts this automation."
          />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Instagram opens the chat on the phone app. In a brand-new chat the automation starts once the person sends their first message; if they already chat with you it starts right away.
          </p>
        </div>
      )}
    </div>
  )
}
