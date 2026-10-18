import { rawQuery } from "@/lib/supabase-server"

export type ShopSchemaStatus = {
  shop_profiles: boolean // migration 16
  links_shop_visible: boolean // migration 16
  links_image_url: boolean // migration 17
  shop_posts: boolean // migration 19
  shop_posts_ig_media_id: boolean // migration 20
  links_price: boolean // migration 21
  shop_avatar: boolean // migration 22
  shop_banner: boolean // migration 23
}

/** Which of the shop migrations have been run. Never throws. */
export async function shopSchemaStatus(): Promise<ShopSchemaStatus> {
  const out: ShopSchemaStatus = { shop_profiles: false, links_shop_visible: false, links_image_url: false, shop_posts: false, shop_posts_ig_media_id: false, links_price: false, shop_avatar: false, shop_banner: false }
  try {
    const rows = await rawQuery<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name IN ('shop_profiles','links','shop_posts')`,
    )
    const has = (t: string, c?: string) => rows.some((r) => r.table_name === t && (!c || r.column_name === c))
    out.shop_profiles = has("shop_profiles")
    out.links_shop_visible = has("links", "shop_visible")
    out.links_image_url = has("links", "image_url")
    out.shop_posts = has("shop_posts")
    out.shop_posts_ig_media_id = has("shop_posts", "ig_media_id")
    out.shop_avatar = has("shop_profiles", "avatar_url")
    out.shop_banner = has("shop_profiles", "banner_url")
    out.links_price = has("links", "price_inr") && has("links", "mrp_inr")
  } catch {
    /* leave everything false */
  }
  return out
}

let igCol: { at: number; value: boolean } | null = null

/** True once migration 20 has been run. A positive answer is kept; a negative one is re-checked every 30 seconds. */
export async function hasIgMediaColumn(): Promise<boolean> {
  if (igCol && (igCol.value || Date.now() - igCol.at < 30_000)) return igCol.value
  const value = (await shopSchemaStatus()).shop_posts_ig_media_id
  igCol = { at: Date.now(), value }
  return value
}

let priceCol: { at: number; value: boolean } | null = null

/** True once migration 21 has been run (same caching as above). */
export async function hasPriceColumns(): Promise<boolean> {
  if (priceCol && (priceCol.value || Date.now() - priceCol.at < 30_000)) return priceCol.value
  const value = (await shopSchemaStatus()).links_price
  priceCol = { at: Date.now(), value }
  return value
}

/** SELECT fragment for the price columns, or NULLs before migration 21. `alias` is the links table alias, if any. */
export async function priceSelect(alias = ""): Promise<string> {
  const a = alias ? `${alias}.` : ""
  return (await hasPriceColumns()) ? `${a}price_inr, ${a}mrp_inr` : `NULL::int AS price_inr, NULL::int AS mrp_inr`
}

let avatarCol: { at: number; value: boolean } | null = null

/** True once migration 22 has been run (same caching as above). */
export async function hasAvatarColumn(): Promise<boolean> {
  if (avatarCol && (avatarCol.value || Date.now() - avatarCol.at < 30_000)) return avatarCol.value
  const value = (await shopSchemaStatus()).shop_avatar
  avatarCol = { at: Date.now(), value }
  return value
}

let bannerCol: { at: number; value: boolean } | null = null

/** True once migration 23 has been run (same caching as above). */
export async function hasBannerColumn(): Promise<boolean> {
  if (bannerCol && (bannerCol.value || Date.now() - bannerCol.at < 30_000)) return bannerCol.value
  const value = (await shopSchemaStatus()).shop_banner
  bannerCol = { at: Date.now(), value }
  return value
}

/** SELECT fragment for the profile picture and banner; each one is NULL until its migration (22, 23) has been run. */
export async function avatarSelect(): Promise<string> {
  const a = (await hasAvatarColumn()) ? "avatar_url" : "NULL::text AS avatar_url"
  const b = (await hasBannerColumn()) ? "banner_url" : "NULL::text AS banner_url"
  return `${a}, ${b}`
}

const LABELS: [keyof ShopSchemaStatus, string][] = [
  ["shop_profiles", "migration 16 (shop pages)"],
  ["links_shop_visible", "migration 16 (shop pages)"],
  ["links_image_url", "migration 17 (link images)"],
  ["shop_posts", "migration 19 (Studio posts)"],
  ["shop_posts_ig_media_id", "migration 20 (reels from Instagram)"],
  ["links_price", "migration 21 (product prices)"],
  ["shop_avatar", "migration 22 (shop profile picture)"],
  ["shop_banner", "migration 23 (shop banner)"],
]

export function missingMigrations(s: ShopSchemaStatus): string[] {
  return [...new Set(LABELS.filter(([k]) => !s[k]).map(([, label]) => label))]
}
