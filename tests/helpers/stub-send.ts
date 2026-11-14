export const sent: any[] = []
export const control = { ok: true }
export async function sendSteps(token: string, recipient: any, senderId: string, content: any, opts: any) {
  sent.push({ recipient, senderId, content, opts })
  return control.ok ? { ok: true, results: [{ ok: true, messageId: `mid_${sent.length}` }] } : { ok: false, results: [{ ok: false, error: "blocked" }] }
}
