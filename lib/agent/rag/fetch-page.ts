/**
 * Fetch ONE web page for "Import a page", through the same SSRF guard as outbound webhooks.
 *
 * Who calls this: lib/agent/rag/service.ts (website import and its Re-index).
 * Why: an owner types any URL, so the server must not be steerable into internal services. Rules (lib/webhooks/ssrf.ts):
 * https only, port 443, no credentials, no localhost-style names, EVERY resolved address public; we connect to the validated
 * IP (DNS pinning) while keeping TLS verification on the real host name. Redirects are followed at most 3 times and every hop is
 * re-validated (a redirect to a private address is refused). 8s total timeout per hop, 1.5 MB cap, text/html or text/plain only.
 * One page per source: this is not a crawler. Node runtime only.
 */
import https from "node:https"
import dns from "node:dns/promises"
import { checkWebhookUrl, resolvePublicAddress } from "../../webhooks/ssrf.ts"
import { extractTextFromHtml } from "./html.ts"

export const PAGE_TIMEOUT_MS = 8000
export const PAGE_MAX_BYTES = 1_500_000
export const MAX_REDIRECTS = 3

export type PageResult = { ok: true; text: string; finalUrl: string } | { ok: false; error: string }

export interface PageDeps {
  /** Replaceable in tests. */
  lookup?: (host: string) => Promise<{ address: string; family: number }[]>
  request?: typeof https.request
}

/** One validated hop. Returns the status, headers and body (capped) or an error string. Never follows redirects itself. */
async function hop(rawUrl: string, deps: PageDeps): Promise<{ ok: true; status: number; headers: Record<string, any>; body: Buffer; url: URL } | { ok: false; error: string }> {
  const checked = checkWebhookUrl(rawUrl)
  if (!checked.ok) return { ok: false, error: checked.reason }
  const url = checked.url
  const target = await resolvePublicAddress(url.hostname, deps.lookup ?? ((h) => dns.lookup(h, { all: true })))
  if (!target.ok) return { ok: false, error: target.reason }
  const req = deps.request ?? https.request
  return new Promise((resolve) => {
    let settled = false
    const done = (v: any) => { if (!settled) { settled = true; resolve(v) } }
    const r = req(
      {
        host: target.address, family: target.family, port: 443, path: `${url.pathname}${url.search}`, method: "GET", servername: url.hostname,
        headers: { Host: url.host, "User-Agent": "Celra-KnowledgeImport/1.0", Accept: "text/html,text/plain;q=0.9", "Accept-Encoding": "identity" },
        timeout: PAGE_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = []
        let size = 0
        res.on("data", (c: Buffer) => {
          size += c.length
          if (size > PAGE_MAX_BYTES) { res.destroy(); done({ ok: false, error: "The page is too large to import." }); return }
          chunks.push(c)
        })
        const finish = () => done({ ok: true, status: res.statusCode ?? 0, headers: res.headers ?? {}, body: Buffer.concat(chunks), url })
        res.on("end", finish)
        res.on("close", finish)
        res.on("error", () => done({ ok: false, error: "The page could not be read." }))
      },
    )
    r.on("timeout", () => r.destroy(new Error("timeout")))
    r.on("error", (e: Error) => done({ ok: false, error: /timeout/i.test(e.message) ? "The page took too long to respond." : "The page could not be reached." }))
    r.end()
  })
}

/** Downloads a page and returns its plain text. */
export async function fetchPageText(rawUrl: string, deps: PageDeps = {}): Promise<PageResult> {
  let current = rawUrl
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const r = await hop(current, deps)
    if (!r.ok) return r
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.location
      if (!loc || i === MAX_REDIRECTS) return { ok: false, error: "The page redirects too many times." }
      try { current = new URL(String(loc), r.url).toString() } catch { return { ok: false, error: "The page redirects to an invalid address." } }
      continue // the next hop is validated again (https, public address) before any request is made
    }
    if (r.status < 200 || r.status >= 300) return { ok: false, error: `The page answered with status ${r.status}.` }
    const type = String(r.headers["content-type"] ?? "").toLowerCase()
    if (!/^text\/(html|plain)|application\/xhtml\+xml/.test(type)) return { ok: false, error: "Only web pages and plain text can be imported (PDFs are not supported yet)." }
    if (r.headers["content-encoding"] && String(r.headers["content-encoding"]).toLowerCase() !== "identity") return { ok: false, error: "The page uses an unsupported encoding." }
    const raw = r.body.toString("utf8")
    const text = /html/.test(type) ? extractTextFromHtml(raw) : raw.trim()
    if (text.length < 20) return { ok: false, error: "No readable text was found on that page." }
    return { ok: true, text, finalUrl: r.url.toString() }
  }
  return { ok: false, error: "The page redirects too many times." }
}
