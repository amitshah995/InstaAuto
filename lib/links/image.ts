import dns from "node:dns/promises"
import net from "node:net"
import { validateDestination } from "@/lib/links/core"

const MAX_HOPS = 4
const MAX_BYTES = 600_000
const TIMEOUT_MS = 6000
const UA = "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)"

function privateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  const v = ip.toLowerCase()
  if (v.startsWith("::ffff:")) return privateIp(v.slice(7))
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")
}

/** Rejects hosts that resolve to private or internal addresses (SSRF guard), on every redirect hop. */
async function safeToFetch(raw: string): Promise<URL | null> {
  const ok = validateDestination(raw)
  if (!ok.ok) return null
  const u = new URL(ok.url)
  try {
    const addrs = await dns.lookup(u.hostname, { all: true })
    if (addrs.length === 0 || addrs.some((a) => privateIp(a.address))) return null
  } catch {
    return null
  }
  return u
}

function metaContent(html: string, keys: string[]): string | null {
  const tags = html.match(/<(meta|link)\b[^>]*>/gi) || []
  for (const key of keys) {
    for (const tag of tags) {
      const id = tag.match(/\b(?:property|name|rel)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()
      if (id !== key) continue
      const val = tag.match(/\b(?:content|href)\s*=\s*["']([^"']+)["']/i)?.[1]
      if (val) return val.replace(/&amp;/g, "&").trim()
    }
  }
  return null
}

/** Best-effort: returns an https image URL from the page's preview tags, or null. Never throws. */
export async function fetchProductImage(pageUrl: string): Promise<string | null> {
  try {
    let current = await safeToFetch(pageUrl)
    for (let hop = 0; current && hop <= MAX_HOPS; hop++) {
      const res = await fetch(current.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      })
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location")
        if (!loc) return null
        current = await safeToFetch(new URL(loc, current).toString())
        continue
      }
      if (!res.ok || !(res.headers.get("content-type") || "").includes("html")) return null
      const reader = res.body?.getReader()
      if (!reader) return null
      let html = ""
      let bytes = 0
      const dec = new TextDecoder()
      while (bytes < MAX_BYTES) {
        const { done, value } = await reader.read()
        if (done || !value) break
        bytes += value.length
        html += dec.decode(value, { stream: true })
        if (html.includes("</head>")) break
      }
      reader.cancel().catch(() => {})
      const found = metaContent(html, ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src", "image_src"])
      if (!found) return null
      return cleanImageUrl(new URL(found, current).toString())
    }
  } catch (e) {
    /* timeouts and blocked sites just mean no image */
    if (process.env.IMG_DEBUG) console.error(e)
  }
  return null
}

/** Accepts only plain https image addresses (used for fetched and pasted URLs). */
export function cleanImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  const v = validateDestination(raw)
  return v.ok && v.url.length <= 1000 ? v.url : null
}

/** True only if the address really serves an image (checked through the same SSRF guard). */
export async function imageIsReachable(url: string): Promise<boolean> {
  try {
    let current = await safeToFetch(url)
    for (let hop = 0; current && hop <= MAX_HOPS; hop++) {
      const res = await fetch(current.toString(), {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "user-agent": UA, range: "bytes=0-1023" },
      })
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location")
        if (!loc) return false
        current = await safeToFetch(new URL(loc, current).toString())
        continue
      }
      res.body?.cancel().catch(() => {})
      return (res.ok || res.status === 206) && (res.headers.get("content-type") || "").toLowerCase().startsWith("image/")
    }
  } catch {}
  return false
}
