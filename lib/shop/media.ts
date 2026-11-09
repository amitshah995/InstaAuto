import { STORAGE_MESSAGES, classifyStorageError, type StorageErrorCode } from "@/lib/shop/storage-errors"

export const MAX_IMAGE_BYTES = 1_500_000
export const MAX_IMAGES_PER_POST = 10
export const MAX_POSTS_PER_USER = 200
export const MAX_PRODUCTS_PER_POST = 6
export const MAX_CAPTION = 1000
export const BUCKET = "shop-media"

export type ImageType = { ext: "jpg" | "png" | "webp"; mime: string }

/** Detects the real image type from the first bytes. The browser-provided type is never trusted. */
export function sniffImage(buf: Uint8Array): ImageType | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: "png", mime: "image/png" }
  const tag = (o: number) => String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3])
  if (tag(0) === "RIFF" && tag(8) === "WEBP") return { ext: "webp", mime: "image/webp" }
  return null
}

export function storageBase(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return url ? url.replace(/\/+$/, "") : null
}

/** Public URL prefix of one user's folder. Post images must live inside it. */
export function userMediaPrefix(userId: string): string | null {
  const base = storageBase()
  return base ? `${base}/storage/v1/object/public/${BUCKET}/${userId}/` : null
}

export const BUCKET_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]
export const BUCKET_SIZE_LIMIT = 5 * 1024 * 1024

/**
 * Supabase's new secret keys (sb_secret_...) are not JWTs and are rejected in an Authorization: Bearer
 * header; they only work in `apikey`. Legacy service_role keys are JWTs and want both.
 */
export function storageHeaders(key: string, extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: key, ...(key.startsWith("eyJ") ? { authorization: `Bearer ${key}` } : {}), ...extra }
}

/**
 * Creates the public bucket with the service role. Safe to call when it already exists (409 counts as success).
 * Called at most once a minute per server instance when an upload reports "Bucket not found", so a fresh Supabase
 * project works without the owner touching the dashboard. If the key may not create buckets, the caller
 * falls back to telling the owner exactly what to create.
 */
// Throttled to one attempt per minute so a key that cannot create buckets is not hammered on every upload.
let bucketTriedAt = 0
export async function ensureBucket(): Promise<boolean> {
  const base = storageBase()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key || Date.now() - bucketTriedAt < 60_000) return false
  bucketTriedAt = Date.now()
  try {
    const res = await fetch(`${base}/storage/v1/bucket`, {
      method: "POST",
      headers: storageHeaders(key, { "content-type": "application/json" }),
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: BUCKET_SIZE_LIMIT, allowed_mime_types: BUCKET_MIME_TYPES }),
      signal: AbortSignal.timeout(10000),
    })
    const text = (await res.text().catch(() => "")).slice(0, 200)
    if (res.ok || /already exists|duplicate/i.test(text) || res.status === 409) return true
    console.error("[shop-media] bucket create failed:", res.status, text)
  } catch (e) {
    console.error("[shop-media] bucket create error:", (e as Error)?.message)
  }
  return false
}

export type UploadResult = { ok: true; url: string } | { ok: false; code: StorageErrorCode; error: string }
const fail = (code: StorageErrorCode): UploadResult => ({ ok: false, code, error: STORAGE_MESSAGES[code] })

export async function uploadToStorage(userId: string, bytes: Uint8Array, type: ImageType): Promise<UploadResult> {
  const base = storageBase()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) return fail("storage_not_configured")
  // The path always starts with the user's id; PUT /api/shop only accepts URLs under that prefix.
  const name = `${userId}/${crypto.randomUUID()}.${type.ext}`
  const send = () =>
    fetch(`${base}/storage/v1/object/${BUCKET}/${name}`, {
      method: "POST",
      headers: storageHeaders(key, { "content-type": type.mime, "x-upsert": "false" }),
      body: bytes as any,
      signal: AbortSignal.timeout(20000),
    })
  let res: Response
  try {
    res = await send()
  } catch (e) {
    console.error("[shop-media] storage unreachable:", (e as Error)?.message)
    return fail("storage_failed")
  }
  let body = res.ok ? "" : (await res.text().catch(() => "")).slice(0, 300)
  let code = res.ok ? null : classifyStorageError(res.status, body)
  if (code === "bucket_missing" && (await ensureBucket())) {
    try {
      res = await send()
      body = res.ok ? "" : (await res.text().catch(() => "")).slice(0, 300)
      code = res.ok ? null : classifyStorageError(res.status, body)
    } catch {
      code = "storage_failed"
    }
  }
  if (code) {
    // Details stay in the server log only; the owner gets the mapped message.
    console.error("[shop-media] storage upload failed:", res.status, code, body)
    return fail(code)
  }
  return { ok: true, url: `${base}/storage/v1/object/public/${BUCKET}/${name}` }
}
