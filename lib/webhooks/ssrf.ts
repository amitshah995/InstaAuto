/**
 * SSRF guard for user-supplied webhook URLs (pure logic, no network).
 *
 * Who calls this: lib/webhooks/safe-fetch.ts before every outbound request, and the
 * /api/webhooks routes when a URL is saved.
 * Why: a creator can type any URL. Without a guard, our server could be made to call internal
 * services or cloud metadata (169.254.169.254). Rules: https only, no credentials in the URL,
 * standard port only, no localhost-style names, and EVERY resolved address must be public.
 */
import { isIP } from "node:net"

/** Parses dotted IPv4 into 4 numbers, or null. */
function v4Parts(ip: string): number[] | null {
  const p = ip.split(".")
  if (p.length !== 4) return null
  const n = p.map((x) => (/^\d{1,3}$/.test(x) ? Number(x) : NaN))
  return n.some((x) => !(x >= 0 && x <= 255)) ? null : n
}

export function isBlockedIPv4(ip: string): boolean {
  const p = v4Parts(ip)
  if (!p) return true // unparseable: refuse
  const [a, b, c] = p
  return (
    a === 0 || // "this network"
    a === 10 || // private
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local, includes cloud metadata 169.254.169.254
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 0 && c === 0) || // IETF protocol assignments
    (a === 192 && b === 0 && c === 2) || // TEST-NET-1
    (a === 192 && b === 168) || // private
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51 && c === 100) || // TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // TEST-NET-3
    a >= 224 // multicast, reserved, broadcast
  )
}

/** Expands an IPv6 literal to 8 hextets (numbers), handling "::" and an embedded dotted IPv4 tail. */
function v6Hextets(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0] // drop zone id
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) {
    const v4 = v4Parts(dotted[1])
    if (!v4) return null
    s = s.slice(0, -dotted[1].length) + ((v4[0] << 8) | v4[1]).toString(16) + ":" + ((v4[2] << 8) | v4[3]).toString(16)
  }
  const halves = s.split("::")
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(":") : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? head.length !== 8 : missing < 0) return null
  const all = halves.length === 1 ? head : [...head, ...Array(missing).fill("0"), ...tail]
  const nums = all.map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN))
  return nums.some(Number.isNaN) ? null : nums
}

export function isBlockedIPv6(ip: string): boolean {
  const h = v6Hextets(ip)
  if (!h) return true
  const embeddedV4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`
  if (h.every((x) => x === 0)) return true // :: unspecified
  if (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return true // ::1 loopback
  // IPv4-mapped (::ffff:a.b.c.d) and deprecated IPv4-compatible (::a.b.c.d): judge by the embedded IPv4.
  if (h.slice(0, 5).every((x) => x === 0) && (h[5] === 0xffff || h[5] === 0)) return isBlockedIPv4(embeddedV4(h[6], h[7]))
  // NAT64 (64:ff9b::/96): judge by the embedded IPv4.
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) return isBlockedIPv4(embeddedV4(h[6], h[7]))
  // 6to4 (2002::/16) embeds an IPv4 in the next 32 bits.
  if (h[0] === 0x2002) return isBlockedIPv4(embeddedV4(h[1], h[2]))
  if ((h[0] & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
  if ((h[0] & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((h[0] & 0xffc0) === 0xfec0) return true // fec0::/10 deprecated site-local
  if ((h[0] & 0xff00) === 0xff00) return true // ff00::/8 multicast
  if (h[0] === 0x2001 && h[1] === 0x0db8) return true // documentation range
  return false
}

export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip)
  if (kind === 4) return isBlockedIPv4(ip)
  if (kind === 6) return isBlockedIPv6(ip)
  return true // not an IP at all: refuse
}

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain", ".home.arpa"]

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string }

/** Syntax-level checks that need no DNS. Returns the parsed URL when acceptable. */
export function checkWebhookUrl(raw: string): UrlCheck {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: "That is not a valid URL" }
  }
  if (url.protocol !== "https:") return { ok: false, reason: "Only https:// URLs are allowed" }
  if (url.username || url.password) return { ok: false, reason: "URLs with a username or password are not allowed" }
  if (url.port && url.port !== "443") return { ok: false, reason: "Only the standard https port (443) is allowed" }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (!host) return { ok: false, reason: "The URL has no host" }
  if (host === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: "Local and internal host names are not allowed" }
  }
  if (isIP(host) && isBlockedIp(host)) return { ok: false, reason: "Private and internal addresses are not allowed" }
  if (raw.length > 2000) return { ok: false, reason: "The URL is too long" }
  return { ok: true, url }
}

export type Resolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>

/**
 * Resolves the host and requires EVERY address to be public. The caller must then connect to one of
 * the returned addresses (not re-resolve), which defeats DNS-rebinding between check and use.
 */
export async function resolvePublicAddress(
  hostname: string,
  resolve: Resolver,
): Promise<{ ok: true; address: string; family: number } | { ok: false; reason: string }> {
  const host = hostname.replace(/^\[|\]$/g, "")
  if (isIP(host)) {
    return isBlockedIp(host) ? { ok: false, reason: "Private and internal addresses are not allowed" } : { ok: true, address: host, family: isIP(host) }
  }
  let addrs: Array<{ address: string; family: number }>
  try {
    addrs = await resolve(host)
  } catch {
    return { ok: false, reason: "The host name could not be resolved" }
  }
  if (addrs.length === 0) return { ok: false, reason: "The host name could not be resolved" }
  if (addrs.some((a) => isBlockedIp(a.address))) return { ok: false, reason: "That host resolves to a private or internal address" }
  return { ok: true, address: addrs[0].address, family: addrs[0].family }
}
