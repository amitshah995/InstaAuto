"use client"

import { useEffect, useMemo, useState } from "react"
import { Link2, Loader2 } from "lucide-react"
import { useInstagramSession } from "@/hooks/use-instagram-session"
import ShopEditor, { type ChecklistItem } from "@/components/links/ShopEditor"
import LinkManager from "@/components/links/LinkManager"
import PhonePreview from "@/components/links/PhonePreview"
import { useShopProfile } from "@/components/links/use-shop-profile"
import { useLinks } from "@/components/links/use-links"
import type { ShopLink } from "@/lib/shop/core"

/** True from the lg breakpoint up, so only ONE preview is mounted (sticky column on desktop, inline on phones). */
function useIsDesktop() {
  const [yes, setYes] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const on = () => setYes(mq.matches)
    on()
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return yes
}

export default function LinksPage() {
  const { userId, isLoading: sessionLoading } = useInstagramSession()
  const shop = useShopProfile()
  const linkState = useLinks(!!userId)
  const desktop = useIsDesktop()

  // Exactly what the public page would list: enabled links the owner ticked.
  const shopLinks: ShopLink[] = useMemo(
    () => linkState.links.filter((l) => l.shop_visible && !l.disabled).map((l) => ({ slug: l.slug, title: l.title, network: l.network, disclose: l.disclose, image_url: l.image_url, price_inr: l.price_inr, mrp_inr: l.mrp_inr })),
    [linkState.links],
  )

  const checklist: ChecklistItem[] = [
    { id: "banner", label: "Add banner", done: !!shop.draft.banner, hint: "add a banner image" },
    { id: "photo", label: "Add photo", done: !!shop.draft.avatar, hint: "add a profile picture or logo" },
    { id: "bio", label: "Write bio", done: shop.draft.bio.trim().length > 0, hint: "write a one-line bio" },
    { id: "links", label: "Add 3 links", done: shopLinks.length >= 3, hint: `show ${Math.max(0, 3 - shopLinks.length)} more link${3 - shopLinks.length === 1 ? "" : "s"} on your page` },
    { id: "publish", label: "Publish", done: shop.published, hint: "turn on Publish when you are ready" },
  ]

  if (sessionLoading || shop.loading) {
    return (
      <div className="celra-landing flex min-h-[60vh] flex-col items-center justify-center gap-4" role="status">
        <Loader2 className="h-10 w-10 animate-spin text-c-brand" />
        <p className="text-sm font-semibold text-muted-foreground">Loading your page...</p>
      </div>
    )
  }

  const totalClicks7d = linkState.links.reduce((a, l) => a + l.clicks_7d, 0)
  const preview = (
    <PhonePreview
      handle={shop.handle || "yourname"} displayName={shop.draft.displayName} bio={shop.draft.bio}
      avatar={shop.draft.avatar} banner={shop.draft.banner} links={shopLinks} published={shop.published}
    />
  )

  return (
    // .celra-landing defines the --c-* Celra tokens (dashboard pages are not inside it by default), which the editor and preview classes need.
    <div className="celra-landing mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="space-y-1 border-b border-c-line pb-6">
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-black tracking-tight md:text-3xl"><Link2 className="h-6 w-6 text-c-brand" /> Links</h1>
        <p className="text-sm text-muted-foreground">
          Build your shop page and keep your tracked links in one place. Use <code>{"{link:code}"}</code> in any DM message and we send a short tracked link and count the clicks.
          {" "}Last 7 days: <b className="text-foreground">{totalClicks7d}</b> clicks.
        </p>
        {shop.loadError && <p role="alert" className="text-sm font-semibold text-destructive">{shop.loadError}</p>}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          <ShopEditor shop={shop} checklist={checklist} />
          {!desktop && (
            <section aria-label="Preview" className="space-y-3">
              <h2 className="font-display text-lg font-bold">Live preview</h2>
              {preview}
            </section>
          )}
          <LinkManager state={linkState} />
        </div>
        {desktop && <aside className="sticky top-20 h-fit">{preview}</aside>}
      </div>
    </div>
  )
}
