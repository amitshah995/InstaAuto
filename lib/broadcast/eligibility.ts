/**
 * Broadcast rules. Instagram only lets a business message someone within 24 hours
 * of THEIR last message to you. A small safety margin keeps us from sending at the edge.
 */
export const WINDOW_MS = 24 * 60 * 60 * 1000
export const SAFETY_MARGIN_MS = 10 * 60 * 1000
export const MAX_RECIPIENTS = 100
export const MAX_TEXT = 900

export function withinWindow(lastInboundAt: string | Date | null | undefined, now = Date.now()): boolean {
  if (!lastInboundAt) return false
  const t = new Date(lastInboundAt).getTime()
  if (!Number.isFinite(t)) return false
  return now - t <= WINDOW_MS - SAFETY_MARGIN_MS && t <= now + 60_000
}

export function personalize(text: string, name?: string | null): string {
  const first = (name || "").trim().split(/\s+/)[0]
  return text.replace(/\{name\}/gi, first || "there")
}

export type Recipient = { igsid: string; name?: string | null; lastInboundAt?: string | null; humanHandled?: boolean }

export function splitRecipients(list: Recipient[], now = Date.now()) {
  const eligible: Recipient[] = []
  let outsideWindow = 0
  let humanHandled = 0
  for (const r of list) {
    if (r.humanHandled) humanHandled++
    else if (!withinWindow(r.lastInboundAt, now)) outsideWindow++
    else eligible.push(r)
  }
  return { eligible: eligible.slice(0, MAX_RECIPIENTS), overCap: Math.max(0, eligible.length - MAX_RECIPIENTS), outsideWindow, humanHandled }
}
