"use client"

import ShopHeader from "@/components/shop/ShopHeader"
import ShopLinkGrid from "@/components/shop/ShopLinkGrid"
import { SHOP_THEME_CSS } from "@/lib/shop/theme-css"
import type { ShopLink } from "@/lib/shop/core"

/**
 * Live phone-frame preview. It renders the SAME ShopHeader + ShopLinkGrid components and CSS as the public
 * page (inert tiles), fed with the owner's unsaved draft, so it updates as they type and upload.
 */
export default function PhonePreview({ handle, displayName, bio, avatar, banner, links, published }: {
  handle: string; displayName: string; bio: string; avatar: string | null; banner: string | null; links: ShopLink[]; published: boolean
}) {
  return (
    <figure className="mx-auto w-full max-w-[320px]" aria-label="Live preview of your public page">
      <div className="rounded-[2.4rem] border border-c-line p-2.5 shadow-sm" style={{ background: "#0E2A33" }}>
        <div className="relative overflow-hidden rounded-[1.9rem] bg-c-bg">
          {/* Notch */}
          <div aria-hidden className="absolute left-1/2 top-2 z-10 h-4 w-20 -translate-x-1/2 rounded-full" style={{ background: "#0E2A33" }} />
          <div className="shop-theme @container h-[560px] overflow-y-auto overscroll-contain pb-6 pt-0 [scrollbar-width:thin]">
            <style>{SHOP_THEME_CSS}</style>
            <ShopHeader handle={handle} displayName={displayName.trim() || null} bio={bio.trim() || null} avatarUrl={avatar} bannerUrl={banner} />
            <div className="px-3 pt-5">
              <ShopLinkGrid links={links} preview />
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">
        {published ? "Live preview. This is what visitors see." : "Preview. Your page is hidden until you publish."}
      </figcaption>
    </figure>
  )
}
