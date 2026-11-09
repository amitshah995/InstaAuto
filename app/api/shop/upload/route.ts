import { type NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { MAX_IMAGE_BYTES, sniffImage, uploadToStorage } from "@/lib/shop/media"
import { STORAGE_MESSAGES, type StorageErrorCode } from "@/lib/shop/storage-errors"

// One already-compressed image per request (the browser shrinks it first, banner <= ~800KB), so it
// stays far below Vercel's 4.5MB body limit. We keep the upload on the server (instead of a signed
// direct-to-storage URL) so the real file type is sniffed from the bytes and size is checked here.
const recent = new Map<string, number[]>()
function limited(key: string) {
  const now = Date.now()
  const hits = (recent.get(key) || []).filter((t) => now - t < 600_000)
  if (hits.length >= 60) return true
  hits.push(now)
  recent.set(key, hits)
  return false
}

// Every failure carries a stable `code` so the UI can show a precise message; the text never contains secrets.
const err = (code: StorageErrorCode, status: number, message?: string) =>
  NextResponse.json({ error: message ?? STORAGE_MESSAGES[code], code }, { status })

export async function POST(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return err("not_signed_in", 401)
  if (limited(userId)) return NextResponse.json({ error: "Too many uploads, try again in a few minutes", code: "rate_limited" }, { status: 429 })
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!file || typeof file === "string") return NextResponse.json({ error: "No image received. Choose a file and try again.", code: "missing_file" }, { status: 400 })
  if (file.size > MAX_IMAGE_BYTES) return err("too_large", 413)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniffImage(bytes)
  if (!type) return err("bad_type", 400)
  const out = await uploadToStorage(userId, bytes, type)
  if (!out.ok) {
    // Config problems are 503 (retrying will not help until the owner acts); transient failures are 502.
    const status = out.code === "storage_failed" ? 502 : out.code === "too_large" ? 413 : out.code === "bad_type" ? 400 : 503
    return err(out.code, status, out.error)
  }
  return NextResponse.json({ url: out.url })
}
