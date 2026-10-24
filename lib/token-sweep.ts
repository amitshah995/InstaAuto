import { rawQuery } from "@/lib/supabase-server"
import { encryptToken, isEncrypted } from "@/lib/token-crypto"

/**
 * Encrypts any Instagram token still stored as plaintext. Safe to run any number of times:
 * it does nothing until TOKEN_ENCRYPTION_KEY is set, skips revoked and already-encrypted rows,
 * and never touches a row it cannot encrypt. Called from the daily token cron, so no terminal is needed.
 */
export async function encryptPlaintextTokens(): Promise<{ encrypted: number; skipped: number; enabled: boolean }> {
  const probe = encryptToken("probe")
  if (probe === "probe") return { encrypted: 0, skipped: 0, enabled: false } // key missing or invalid
  const rows = await rawQuery<{ id: string; access_token: string | null }>(
    `SELECT id, access_token FROM users
      WHERE access_token IS NOT NULL AND access_token <> 'REVOKED' AND access_token NOT LIKE 'enc:v1:%' LIMIT 500`,
  )
  let encrypted = 0
  let skipped = 0
  for (const r of rows) {
    const t = r.access_token
    if (!t || isEncrypted(t)) {
      skipped++
      continue
    }
    const enc = encryptToken(t)
    if (enc === t) {
      skipped++
      continue
    }
    // Guard on the old value so a token refreshed in the meantime is not overwritten.
    await rawQuery(`UPDATE users SET access_token = $1 WHERE id = $2 AND access_token = $3`, [enc, r.id, t])
    encrypted++
  }
  return { encrypted, skipped, enabled: true }
}
