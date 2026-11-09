"use client"

import { AlertCircle, Check, CheckCircle2, Circle, Loader2, Store } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import ProgressRing from "./ProgressRing"
import UploadZone from "./UploadZone"
import SharePanel from "./SharePanel"
import type { useShopProfile } from "./use-shop-profile"

type Shop = ReturnType<typeof useShopProfile>
export type ChecklistItem = { id: string; label: string; done: boolean; hint: string }

const MAX_NAME = 60
const MAX_BIO = 160

/** Counter that turns coral near the limit, so the cut-off never surprises the owner. */
function Counter({ n, max }: { n: number; max: number }) {
  return <span className={`text-xs tabular-nums ${n >= max ? "font-bold text-destructive" : "text-muted-foreground"}`}>{n}/{max}</span>
}

export default function ShopEditor({ shop, checklist }: { shop: Shop; checklist: ChecklistItem[] }) {
  const { draft, patchDraft, handle, handleError, url, published, saving, busy, errors } = shop
  const done = checklist.filter((c) => c.done).length
  const pct = (done / checklist.length) * 100
  const next = checklist.find((c) => !c.done)

  return (
    <div className="space-y-5">
      {/* Status + completeness */}
      <Card className="space-y-4 border-c-line bg-c-surface p-5">
        <div className="flex flex-wrap items-center gap-4">
          <ProgressRing value={pct} />
          <div className="min-w-[11rem] flex-1">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Store className="h-4.5 w-4.5 text-c-brand" /> Your shop page</h2>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {done === checklist.length ? "All set. Your page is complete and live." : next ? `Next: ${next.hint}` : ""}
            </p>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${published ? "bg-c-brand text-c-bg" : "border border-c-line bg-c-soft text-c-muted"}`}
              role="status"
            >
              {published ? "Live" : "Hidden"}
            </span>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <Switch
                checked={published}
                disabled={saving || !handle}
                onCheckedChange={(v) => shop.save(v)}
                aria-label={published ? "Hide shop page" : "Publish shop page"}
                className="data-[state=checked]:bg-c-brand"
              />
              {published ? "Published" : "Publish"}
            </label>
          </div>
        </div>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {checklist.map((c) => (
            <li key={c.id} className={`flex items-center gap-2 text-sm ${c.done ? "text-muted-foreground line-through decoration-c-line" : "font-semibold"}`}>
              {c.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-c-brand" aria-label="Done" /> : <Circle className="h-4 w-4 shrink-0 text-c-muted" aria-label="To do" />}
              {c.label}
            </li>
          ))}
        </ul>
      </Card>

      {/* Pictures */}
      <Card className="space-y-6 border-c-line bg-c-surface p-5">
        <UploadZone
          kind="banner" name="banner image" label="Banner"
          hint="Wide image, shown across the top. We crop it to the centre at 1800 x 400, so keep the subject in the middle. JPG, PNG or WebP."
          value={draft.banner} busy={busy.banner} error={errors.banner}
          onFile={(f) => shop.upload("banner", f)} onRemove={() => shop.remove("banner")}
        />
        <UploadZone
          kind="avatar" name="profile picture or logo" label="Profile picture or logo"
          hint="Shown in a round frame, cropped to a centred square (512 x 512). JPG, PNG or WebP."
          value={draft.avatar} busy={busy.avatar} error={errors.avatar}
          onFile={(f) => shop.upload("avatar", f)} onRemove={() => shop.remove("avatar")}
        />
      </Card>

      {/* Text */}
      <Card className="space-y-4 border-c-line bg-c-surface p-5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between"><label htmlFor="shop-name" className="text-sm font-bold">Display name</label><Counter n={draft.displayName.length} max={MAX_NAME} /></div>
          <Input id="shop-name" value={draft.displayName} onChange={(e) => patchDraft({ displayName: e.target.value })} placeholder={handle ? `@${handle}` : "Display name"} maxLength={MAX_NAME} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between"><label htmlFor="shop-bio" className="text-sm font-bold">Bio</label><Counter n={draft.bio.length} max={MAX_BIO} /></div>
          <textarea
            id="shop-bio" value={draft.bio} onChange={(e) => patchDraft({ bio: e.target.value })} maxLength={MAX_BIO} rows={3}
            placeholder="e.g. Honest picks for everyday style. New finds every Friday."
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-bold">Page address</span>
          {handle ? (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <code className="rounded-lg border border-c-line bg-c-soft px-2.5 py-1.5 font-mono text-xs">{url?.replace(/^https?:\/\//, "") || `/@${handle}`}</code>
              {/* The address is always your own Instagram username, so it cannot clash with anyone else's. */}
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-c-brand"><Check className="h-3.5 w-3.5" /> Reserved for you</span>
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive" role="alert"><AlertCircle className="h-3.5 w-3.5" /> {handleError || "We could not read your Instagram username."}</p>
          )}
          <p className="text-xs text-muted-foreground">Your address is your Instagram username, so nobody else can take it.</p>
        </div>
      </Card>

      {url && handle && (
        <Card className="space-y-3 border-c-line bg-c-surface p-5">
          <h3 className="font-display text-base font-bold">Share your page</h3>
          <SharePanel url={url} handle={handle} published={published} />
        </Card>
      )}

      {/* Unsaved changes bar. Sticky so Save is always in reach while scrolling a long editor. */}
      <div className={`sticky bottom-3 z-20 transition-all motion-reduce:transition-none ${shop.dirty || errors.save ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`} aria-live="polite">
        {(shop.dirty || errors.save) && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-c-line bg-c-surface p-3 shadow-lg">
            <p className="min-w-0 flex-1 text-sm font-semibold">{errors.save ? <span className="text-destructive">{errors.save}</span> : "You have unsaved changes."}</p>
            <button type="button" onClick={() => shop.save()} disabled={saving || !handle} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-c-accent px-5 text-sm font-bold text-c-accent-ink hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-c-brand disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {published ? "Save changes" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
