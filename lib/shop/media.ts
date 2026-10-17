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

export async function uploadToStorage(userId: string, bytes: Uint8Array, type: ImageType): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const base = storageBase()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) return { ok: false, error: "Image storage is not set up yet (see setup steps)." }
  const name = `${userId}/${crypto.randomUUID()}.${type.ext}`
  const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${name}`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": type.mime, "x-upsert": "false" },
    body: bytes as any,
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) {
    console.error("[shop-media] storage upload failed:", res.status, (await res.text().catch(() => "")).slice(0, 200))
    return { ok: false, error: res.status === 404 ? `Create a public storage bucket named "${BUCKET}" first.` : "Image upload failed" }
  }
  return { ok: true, url: `${base}/storage/v1/object/public/${BUCKET}/${name}` }
}
