export type LinkRow = {
  id: string
  slug: string
  title: string
  url: string
  network: string | null
  disclose: boolean
  disabled: boolean
  shop_visible: boolean
  image_url: string | null
  price_inr?: number | null
  mrp_inr?: number | null
  clicks_total: number
  clicks_7d: number
  visitors_7d: number
}

/** The editable shop profile. `saved` is what the server has, `draft` is what the owner sees in the preview. */
export type ShopDraft = { displayName: string; bio: string; avatar: string | null; banner: string | null }
