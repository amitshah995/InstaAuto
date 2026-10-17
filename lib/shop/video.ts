export const MAX_VIDEOS_PER_USER = 12

export type IgMedia = { kind: "reel" | "p" | "tv"; shortcode: string }

/**
 * Accepts an Instagram reel / post / IGTV address and returns its kind and shortcode.
 * Only these two values are stored, so the page can never embed anything but instagram.com.
 */
export function parseInstagramUrl(raw: unknown): { ok: true; media: IgMedia } | { ok: false; error: string } {
  if (typeof raw !== "string" || raw.length > 500) return { ok: false, error: "Paste an Instagram reel or post link" }
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return { ok: false, error: "That does not look like a valid link" }
  }
  const host = u.hostname.toLowerCase()
  if (u.protocol !== "https:" || (host !== "instagram.com" && host !== "www.instagram.com")) {
    return { ok: false, error: "Only instagram.com links are allowed" }
  }
  const m = u.pathname.match(/^\/(?:[A-Za-z0-9._]+\/)?(reels?|p|tv)\/([A-Za-z0-9_-]{5,25})\/?$/)
  if (!m) return { ok: false, error: "Use the link of a reel or post (instagram.com/reel/...)" }
  const kind = m[1] === "reels" ? "reel" : (m[1] as IgMedia["kind"])
  return { ok: true, media: { kind, shortcode: m[2] } }
}

export function embedUrl(kind: string, shortcode: string): string {
  const k = kind === "p" || kind === "tv" ? kind : "reel"
  return `https://www.instagram.com/${k}/${encodeURIComponent(shortcode)}/embed`
}

export function watchUrl(kind: string, shortcode: string): string {
  const k = kind === "p" || kind === "tv" ? kind : "reel"
  return `https://www.instagram.com/${k}/${encodeURIComponent(shortcode)}/`
}
