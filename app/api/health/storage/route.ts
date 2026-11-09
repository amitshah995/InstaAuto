import { type NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { BUCKET, BUCKET_MIME_TYPES, BUCKET_SIZE_LIMIT, ensureBucket, storageBase, storageHeaders } from "@/lib/shop/media"

// GET /api/health/storage (signed in): tells the owner exactly what is wrong with image uploads.
// Reports yes/no and the bucket's public flag only. It never returns a key, a URL secret or raw storage output.
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (!getSessionUserId(request)) return NextResponse.json({ error: "Not signed in" }, { status: 401 })
  const base = storageBase()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const out: Record<string, unknown> = { supabaseUrlSet: !!base, serviceRoleKeySet: !!key, bucket: BUCKET, bucketExists: false, bucketPublic: false, canWrite: false, hint: "" }
  if (!base || !key) {
    out.hint = "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the hosting environment, then redeploy."
    return NextResponse.json({ ok: false, ...out })
  }
  try {
    const get = () => fetch(`${base}/storage/v1/bucket/${BUCKET}`, { headers: storageHeaders(key), signal: AbortSignal.timeout(8000) })
    let res = await get()
    if (!res.ok && res.status !== 401 && res.status !== 403) {
      // Missing bucket: try to create it once (public, 5MB, images only), then look again.
      if (await ensureBucket()) { out.bucketCreatedNow = true; res = await get() }
    }
    if (res.ok) {
      const b = await res.json().catch(() => ({}))
      out.bucketExists = true
      out.bucketPublic = !!b.public
      out.limitOk = !b.file_size_limit || b.file_size_limit >= BUCKET_SIZE_LIMIT / 5
      out.mimeRestricted = Array.isArray(b.allowed_mime_types) && !BUCKET_MIME_TYPES.every((m) => b.allowed_mime_types.includes(m))
      // Write + delete a 1-byte probe to prove the key can really upload.
      const probe = `_health/${crypto.randomUUID()}.png`
      const up = await fetch(`${base}/storage/v1/object/${BUCKET}/${probe}`, { method: "POST", headers: storageHeaders(key, { "content-type": "image/png" }), body: new Uint8Array([0x89]), signal: AbortSignal.timeout(8000) })
      out.canWrite = up.ok || up.status === 415 // 415 = bucket mime filter rejected our fake bytes, but auth and bucket are fine
      if (up.ok) await fetch(`${base}/storage/v1/object/${BUCKET}/${probe}`, { method: "DELETE", headers: storageHeaders(key), signal: AbortSignal.timeout(8000) }).catch(() => {})
    } else if (res.status === 401 || res.status === 403) {
      out.hint = "Supabase rejected SUPABASE_SERVICE_ROLE_KEY. Use the service_role (secret) key from the same project as NEXT_PUBLIC_SUPABASE_URL."
    } else {
      console.error("[health/storage] bucket lookup failed:", res.status)
    }
  } catch (e) {
    console.error("[health/storage] error:", (e as Error)?.message)
    out.hint = "Could not reach Supabase Storage from the server."
  }
  if (!out.hint) {
    out.hint = !out.bucketExists ? `Create a public bucket named "${BUCKET}" in Supabase > Storage.` : !out.bucketPublic ? `Make the "${BUCKET}" bucket public (Storage > ${BUCKET} > Edit bucket > Public).` : !out.canWrite ? "The bucket exists but the server could not write to it." : "Storage looks good."
  }
  return NextResponse.json({ ok: !!out.bucketExists && !!out.bucketPublic && !!out.canWrite, ...out })
}
