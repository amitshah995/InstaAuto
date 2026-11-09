/**
 * Maps a Supabase Storage failure to a stable code + a message that is safe to show the owner.
 * Pure (no I/O) so it is unit-tested.
 *
 * Why this exists: Supabase answers "Bucket not found" with HTTP 400 and the real status only inside
 * the JSON body ({"statusCode":"404",...}). The old code looked at the HTTP status alone, never saw a
 * 404, and so every missing-bucket failure fell through to the useless "Image upload failed".
 */
export type StorageErrorCode =
  | "not_signed_in"
  | "too_large"
  | "bad_type"
  | "storage_not_configured"
  | "bucket_missing"
  | "storage_auth"
  | "storage_failed"

export const STORAGE_MESSAGES: Record<StorageErrorCode, string> = {
  not_signed_in: "Not signed in. Please sign in again and retry.",
  too_large: "File too large. Pick a smaller image (we shrink it for you, but this one could not be made small enough).",
  bad_type: "Only JPG, PNG or WebP images are allowed.",
  storage_not_configured: "Image storage is not set up yet: the server is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
  bucket_missing: 'Storage is not set up yet: create a public bucket named "shop-media" in Supabase Storage.',
  storage_auth: "Storage rejected the server key. Check that SUPABASE_SERVICE_ROLE_KEY is the service_role (secret) key of the same project.",
  storage_failed: "Image upload failed on the server. Please try again in a minute.",
}

/** Status of the failed storage call plus the (already truncated) response body text. */
export function classifyStorageError(httpStatus: number, body: string): StorageErrorCode {
  let inner: { statusCode?: string | number; error?: string; message?: string } = {}
  try { inner = JSON.parse(body) } catch { /* body was not JSON */ }
  const text = `${inner.error || ""} ${inner.message || ""} ${body}`.toLowerCase()
  const status = Number(inner.statusCode) || httpStatus

  if (/bucket not found/.test(text) || (status === 404 && /bucket/.test(text))) return "bucket_missing"
  if (status === 413 || /exceeded the maximum allowed size|payload too large/.test(text)) return "too_large"
  if (status === 415 || /mime type .* not supported|invalid mime/.test(text)) return "bad_type"
  if (status === 401 || status === 403 || /row-level security|invalid jwt|invalid compact jws|signature verification|unauthorized/.test(text)) return "storage_auth"
  return "storage_failed"
}
