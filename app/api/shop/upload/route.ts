/**
 * Slot for the owner's WhatsApp SaaS API. Nothing is sent until these env vars are filled:
 *   WHATSAPP_SAAS_API_BASE   e.g. https://api.your-whatsapp-app.com
 *   WHATSAPP_SAAS_API_KEY    server-side only, never exposed to the browser
 * Fill in `sendPostToWhatsApp` once the API (auth, template endpoint, contact endpoint) is known.
 */
export function whatsappConfigured(): boolean {
  return !!process.env.WHATSAPP_SAAS_API_BASE && !!process.env.WHATSAPP_SAAS_API_KEY
}

export type WhatsappSendResult = { ok: true; queued: number } | { ok: false; error: string; notConfigured?: boolean }

export async function sendPostToWhatsApp(_input: { userId: string; postUrl: string; caption?: string | null }): Promise<WhatsappSendResult> {
  if (!whatsappConfigured()) return { ok: false, error: "WhatsApp is not connected yet", notConfigured: true }
  // TODO(api): call the WhatsApp SaaS here (template message with the post URL as a variable, opt-in contacts only).
  return { ok: false, error: "WhatsApp sending is not implemented yet", notConfigured: true }
}
