import { rawQuery } from "@/lib/supabase-server"

export type ShopSchemaStatus = {
  shop_profiles: boolean // migration 16
  links_shop_visible: boolean // migration 16
  links_image_url: boolean // migration 17
  shop_posts: boolean // migration 19
  shop_posts_ig_media_id: boolean // migration 20
}

/** Which of the shop migrations have been run. Never throws. */
export async function shopSchemaStatus(): Promise<ShopSchemaStatus> {
  const out: ShopSchemaStatus = { shop_profiles: false, links_shop_visible: false, links_image_url: false, shop_posts: false, shop_posts_ig_media_id: false }
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

const LABELS: [keyof ShopSchemaStatus, string][] = [
  ["shop_profiles", "migration 16 (shop pages)"],
  ["links_shop_visible", "migration 16 (shop pages)"],
  ["links_image_url", "migration 17 (link images)"],
  ["shop_posts", "migration 19 (Studio posts)"],
  ["shop_posts_ig_media_id", "migration 20 (reels from Instagram)"],
]

export function missingMigrations(s: ShopSchemaStatus): string[] {
  return [...new Set(LABELS.filter(([k]) => !s[k]).map(([, label]) => label))]
}
