/**
 * SSRF-safe HTTPS POST for outbound webhooks.
 *
 * Who calls this: lib/webhooks/events.ts (deliveries and the "send test" button).
 * Why a custom request instead of fetch(): we must connect to the exact IP we validated
 * (DNS pinning), keep TLS verification against the real host name (SNI), never follow redirects
 * (a redirect could point at an internal address), cap the response size and enforce a timeout.
 * Node runtime only (uses node:https and node:dns).
 */
import https from "node:https"
import dns from "node:dns/promises"
import { checkWebhookUrl, resolvePublicAddress } from "./ssrf.ts"

export interface PostResult {
  ok: boolean
  status?: number
  error?: string
  /** True for problems retrying cannot fix (blocked URL), so the delivery is not retried. */
  permanent?: boolean
}

export const DELIVERY_TIMEOUT_MS = 8000
const MAX_RESPONSE_BYTES = 4096

export async function safePost(
  rawUrl: string,
  body: string,
  headers: Record<string, string>,
  opts: { timeoutMs?: number; treatRedirectAsSuccess?: boolean } = {},
): Promise<PostResult> {
  const checked = checkWebhookUrl(rawUrl)
  if (!checked.ok) return { ok: false, error: checked.reason, permanent: true }
  const url = checked.url

  // Resolve first, validate every address, then connect to the validated one only.
  const target = await resolvePublicAddress(url.hostname, (h) => dns.lookup(h, { all: true }))
  if (!target.ok) return { ok: false, error: target.reason, permanent: true }

  return new Promise<PostResult>((resolve) => {
    const req = https.request(
      {
        host: target.address,
        family: target.family,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        servername: url.hostname, // TLS SNI + certificate check use the real host name
        headers: { ...headers, Host: url.host, "Content-Length": Buffer.byteLength(body).toString() },
        timeout: opts.timeoutMs ?? DELIVERY_TIMEOUT_MS,
      },
      (res) => {
        let size = 0
        res.on("data", (chunk: Buffer) => {
          size += chunk.length
          if (size > MAX_RESPONSE_BYTES) res.destroy() // we never need the body; stop reading
        })
        const done = () => {
          const s = res.statusCode ?? 0
          const redirectOk = opts.treatRedirectAsSuccess && s >= 300 && s < 400
          resolve({ ok: (s >= 200 && s < 300) || !!redirectOk, status: s, error: s >= 300 && !redirectOk ? `HTTP ${s}` : undefined })
        }
        res.on("end", done)
        res.on("close", done)
      },
    )
    req.on("timeout", () => req.destroy(new Error("Timed out")))
    req.on("error", (e) => resolve({ ok: false, error: e.message.slice(0, 200) }))
    req.end(body)
  })
}
