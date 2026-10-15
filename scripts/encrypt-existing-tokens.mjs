#!/usr/bin/env node
/**
 * One-off backfill: encrypt plaintext users.access_token values in place.
 *
 * Run ONLY after the app version containing lib/token-crypto.ts is deployed with
 * TOKEN_ENCRYPTION_KEY set (so every reader can decrypt).
 *
 *   DATABASE_URL=... TOKEN_ENCRYPTION_KEY=... node scripts/encrypt-existing-tokens.mjs          # dry run
 *   DATABASE_URL=... TOKEN_ENCRYPTION_KEY=... node scripts/encrypt-existing-tokens.mjs --apply  # write
 *
 * Format must match lib/token-crypto.ts: enc:v1:<iv>:<tag>:<ciphertext> (base64url).
 */
import crypto from "crypto"
import pg from "pg"

const apply = process.argv.includes("--apply")
const PREFIX = "enc:v1:"

const raw = process.env.TOKEN_ENCRYPTION_KEY
if (!raw || !process.env.DATABASE_URL) {
  console.error("DATABASE_URL and TOKEN_ENCRYPTION_KEY are required.")
  process.exit(1)
}
const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64")
if (key.length !== 32) {
  console.error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes.")
  process.exit(1)
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return `${PREFIX}${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ct.toString("base64url")}`
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
try {
  const { rows } = await pool.query("SELECT id, access_token FROM users")
  let todo = 0
  let skipped = 0
  for (const row of rows) {
    const t = row.access_token
    if (!t || t === "REVOKED" || t.startsWith(PREFIX)) {
      skipped++
      continue
    }
    todo++
    if (apply) {
      await pool.query("UPDATE users SET access_token = $1 WHERE id = $2", [encrypt(t), row.id])
    }
  }
  console.log(`${apply ? "Encrypted" : "Would encrypt"} ${todo} token(s); skipped ${skipped} (revoked/already encrypted).`)
  if (!apply) console.log("Dry run. Re-run with --apply to write.")
} finally {
  await pool.end()
}
