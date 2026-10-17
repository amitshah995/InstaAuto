/**
 * Pure helpers for the creator shop page (/@handle). No database access, easy to test.
 */

export const MAX_DISPLAY_NAME = 60
export const MAX_BIO = 160

// Instagram usernames: 1-30 chars, letters, digits, dot and underscore. No leading/trailing dot, no "..".
const HANDLE_RE = /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$/

// Names that could be mistaken for the product itself or its staff.
const RESERVED = new Set([
  "admin", "administrator", "api", "app", "dashboard", "help", "support", "security", "staff", "team",
  "official", "root", "system", "login", "logout", "signup", "settings", "privacy", "terms", "about",
  "dmspark", "instagram", "meta", "facebook", "whatsapp", "shop", "l", "tools", "audit",
])

/** Lowercases and strips a leading "@". Returns the handle, or an error message. */
export function normalizeHandle(raw: unknown): { ok: true; handle: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Handle is required" }
  const h = raw.trim().replace(/^@/, "").toLowerCase()
  if (!h) return { ok: false, error: "Handle is required" }
  if (!HANDLE_RE.test(h)) return { ok: false, error: "Use 1-30 letters, numbers, dots or underscores" }
  if (RESERVED.has(h)) return { ok: false, error: "That handle is reserved" }
  return { ok: true, handle: h }
}

/** Removes control and invisible-direction characters, collapses whitespace, trims and caps length. */
export function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== "string") return ""
  return raw
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max)
}

export function shopUrl(base: string, handle: string): string {
  return `${base.replace(/\/+$/, "")}/@${handle}`
}

export type ShopLink = { slug: string; title: string; network: string | null; disclose: boolean; image_url: string | null }

/** True when at least one visible link carries the affiliate note, so the page shows its disclosure. */
export function needsDisclosure(links: ShopLink[]): boolean {
  return links.some((l) => l.disclose)
}

/** Initial for the avatar circle (first letter or digit; "?" if none). */
export function initialOf(name: string): string {
  const m = name.match(/[A-Za-z0-9]/)
  return m ? m[0].toUpperCase() : "?"
}
