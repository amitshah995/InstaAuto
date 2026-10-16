import { rawQuery } from "@/lib/supabase-server"
import { expandTokens, findLinkTokens, type LinkInfo } from "@/lib/links/core"

/** Expands {link:slug} in a message for one account. Only that account's own, enabled links resolve. */
export async function expandLinksForUser(userId: number | string, text: string, source = "dm"): Promise<string> {
  if (!text || !text.includes("{link:")) return text
  const slugs = findLinkTokens(text)
  if (slugs.length === 0) return text
  try {
    const rows = await rawQuery<{ slug: string; disclose: boolean }>(
      `SELECT slug, disclose FROM links WHERE user_id = $1 AND disabled = FALSE AND slug = ANY($2)`,
      [userId, slugs],
    )
    const map = new Map<string, LinkInfo>(rows.map((r) => [r.slug, { slug: r.slug, disclose: r.disclose }]))
    return expandTokens(text, map, source)
  } catch (e) {
    console.error("[links] expand failed (is migration 15 run?):", (e as Error)?.message)
    return expandTokens(text, new Map(), source) // never send a raw token
  }
}
