import { type NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { MAX_IMAGE_BYTES, sniffImage, uploadToStorage } from "@/lib/shop/media"

// One already-compressed image per request (the browser shrinks it first), so it stays under the host's body limit.
const recent = new Map<string, number[]>()
function limited(key: string) {
  const now = Date.now()
  const hits = (recent.get(key) || []).filter((t) => now - t < 600_000)
  if (hits.length >= 60) return true
  hits.push(now)
  recent.set(key, hits)
  return false
}

export async function POST(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (limited(userId)) return NextResponse.json({ error: "Too many uploads, try again in a few minutes" }, { status: 429 })
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!file || typeof file === "string") return NextResponse.json({ error: "Missing image" }, { status: 400 })
  if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Image is too large" }, { status: 413 })
  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniffImage(bytes)
  if (!type) return NextResponse.json({ error: "Only JPG, PNG or WebP images are allowed" }, { status: 400 })
  const out = await uploadToStorage(userId, bytes, type)
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 500 })
  return NextResponse.json({ url: out.url })
}
