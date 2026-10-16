/**
 * Pure helpers for tracked links: destination safety, slugs, bot detection,
 * and {link:slug} expansion. No database access here so it is easy to test.
 */
import crypto from "crypto"
import { getSiteHost, getSiteUrl } from "@/lib/site"

export const MAX_LINKS_PER_USER = 100
export const MAX_URL_LEN = 2000
export const REPORTS_TO_DISABLE = 3
const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789" // no look-alikes (i, l, o, 0, 1)

export function siteBase() {
  return getSiteUrl()
}

export function makeSlug(len = 7): string {
  const bytes = crypto.randomBytes(len)
  let out = ""
  for (let i = 0; i < len; i++) out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length]
  return out
}

const BLOCKED_HOST_SUFFIXES = ["dmspark.in", "localhost", "internal", "local", "lan", "home.arpa"]

function isPrivateOrIpHost(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true // any IPv4 literal
  if (host.includes(":") || host.startsWith("[")) return true // IPv6 literal
  if (/^\d+$/.test(host) || /^0x/i.test(host)) return true // numeric / hex host tricks
  return false
}

/** Returns the cleaned URL or an error message. Only public https destinations are allowed. */
export function validateDestination(raw: unknown): { ok: true; url: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Link is required" }
  const s = raw.trim()
  if (!s || s.length > MAX_URL_LEN) return { ok: false, error: "Link is empty or too long" }
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return { ok: false, error: "That does not look like a valid link" }
  }
  if (u.protocol !== "https:") return { ok: false, error: "Only https links are allowed" }
  if (u.username || u.password) return { ok: false, error: "Links with a username or password are not allowed" }
  const host = u.hostname.toLowerCase().replace(/\.$/, "")
  if (!host.includes(".") || isPrivateOrIpHost(host)) return { ok: false, error: "Use a normal website address" }
  const own = getSiteHost()
  const blocked = [...BLOCKED_HOST_SUFFIXES, own, own.replace(/^www\./, "")]
  if (blocked.some((b) => host === b || host.endsWith("." + b))) return { ok: false, error: "That address cannot be used" }
  return { ok: true, url: u.toString() }
}

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python-requests|headless|lighthouse|monitor|uptime|axios|go-http|java\//i
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true
  return BOT_RE.test(ua)
}

/** Daily-rotating hash so we can count unique visitors without storing IPs. */
export function visitorHash(ip: string, ua: string, day = new Date().toISOString().slice(0, 10)): string {
  const salt = process.env.LINK_HASH_SALT || process.env.API_SECRET_KEY || "dmspark-links"
  return crypto.createHash("sha256").update(`${salt}|${day}|${ip}|${ua}`).digest("hex").slice(0, 32)
}

const TOKEN_RE = /\{link:([a-z0-9]{4,12})\}/gi
export function findLinkTokens(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(TOKEN_RE)) {
    const slug = m[1].toLowerCase()
    if (!out.includes(slug)) out.push(slug)
  }
  return out
}

export type LinkInfo = { slug: string; disclose: boolean }

/**
 * Replaces {link:slug} with the tracked short URL. Unknown or disabled slugs are
 * replaced with an empty string so a broken token is never sent to a follower.
 * If any used link has disclose=true, one disclosure line is appended.
 */
export function expandTokens(text: string, known: Map<string, LinkInfo>, source = "dm"): string {
  let disclose = false
  const out = text.replace(TOKEN_RE, (_m, slugRaw: string) => {
    const info = known.get(slugRaw.toLowerCase())
    if (!info) return ""
    if (info.disclose) disclose = true
    return `${siteBase()}/l/${info.slug}?s=${encodeURIComponent(source)}`
  })
  const cleaned = out.replace(/[ \t]+\n/g, "\n").trim()
  return disclose ? `${cleaned}\n\n(This is an affiliate link. I may earn a commission.)` : cleaned
}
