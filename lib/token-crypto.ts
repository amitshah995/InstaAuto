import crypto from "crypto"

/**
 * AES-256-GCM encryption for Instagram access tokens stored in `users`.
 *
 * Stored format: enc:v1:<iv b64url>:<tag b64url>:<ciphertext b64url>
 *
 * Requires TOKEN_ENCRYPTION_KEY: 32 bytes, base64 or hex.
 * Generate with: openssl rand -base64 32
 *
 * Rollout-safe by design:
 *  - decryptToken() passes plaintext (and "REVOKED") through unchanged, so
 *    reads work before and after the backfill.
 *  - encryptToken() is a no-op when the key is not configured, so enabling the
 *    key is the switch that turns on encryption for new writes.
 */

const PREFIX = "enc:v1:"

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY
  if (!raw) return null
  let key: Buffer
  if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, "hex")
  else key = Buffer.from(raw, "base64")
  if (key.length !== 32) {
    console.error("[token-crypto] TOKEN_ENCRYPTION_KEY must decode to 32 bytes; encryption disabled")
    return null
  }
  return key
}

export function isEncrypted(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(PREFIX)
}

export function encryptToken(plain: string): string {
  if (!plain || plain === "REVOKED" || isEncrypted(plain)) return plain
  const key = getKey()
  if (!key) return plain

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ct.toString("base64url")}`
}

export function decryptToken(value: string): string {
  if (!isEncrypted(value)) return value
  const key = getKey()
  if (!key) {
    throw new Error("Encrypted token found but TOKEN_ENCRYPTION_KEY is not configured")
  }
  const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(":")
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8")
}
