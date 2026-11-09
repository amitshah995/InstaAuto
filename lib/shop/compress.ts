/** Browser-side: shrink a photo to max 1200px and re-encode (WebP, or JPEG where WebP is unsupported) so uploads stay small. */
export async function compressImage(file: File, maxSide = 1200): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not process the image")
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q))
  for (const q of [0.82, 0.7, 0.55]) {
    const webp = await toBlob("image/webp", q)
    const blob = webp && webp.type === "image/webp" ? webp : await toBlob("image/jpeg", q)
    if (blob && blob.size <= 1_400_000) return blob
  }
  throw new Error("Image is too large even after shrinking")
}

export type ShopImageKind = "banner" | "avatar"

/** Output size and byte budget per kind. Banner is 4.5:1 (matches the page), avatar is a square for the round frame. */
export const SHOP_IMAGE_SPEC: Record<ShopImageKind, { w: number; h: number; maxBytes: number }> = {
  banner: { w: 1800, h: 400, maxBytes: 800_000 },
  avatar: { w: 512, h: 512, maxBytes: 300_000 },
}

/** Largest source rectangle with the target aspect ratio, centred (CSS "object-fit: cover" maths). Pure so it is testable. */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number) {
  const srcRatio = srcW / srcH
  const dstRatio = dstW / dstH
  if (srcRatio > dstRatio) {
    const sw = Math.round(srcH * dstRatio)
    return { sx: Math.round((srcW - sw) / 2), sy: 0, sw, sh: srcH }
  }
  const sh = Math.round(srcW / dstRatio)
  return { sx: 0, sy: Math.round((srcH - sh) / 2), sw: srcW, sh }
}

export class ImageProcessError extends Error {}

/**
 * Browser-side: centre-crops to the exact banner/avatar shape, resizes on a canvas and re-encodes
 * (WebP, JPEG fallback) until it fits the byte budget. Doing this before upload keeps requests tiny
 * (Vercel rejects bodies over ~4.5MB) and means phone photos of 8MB+ just work.
 */
export async function prepareShopImage(file: File, kind: ShopImageKind): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new ImageProcessError("Only JPG, PNG or WebP images are allowed.")
  if (file.size > 25 * 1024 * 1024) throw new ImageProcessError("File too large. Choose an image under 25 MB.")
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new ImageProcessError("We could not read that image. Try a different JPG, PNG or WebP file.")
  }
  const spec = SHOP_IMAGE_SPEC[kind]
  const { sx, sy, sw, sh } = coverCrop(bitmap.width, bitmap.height, spec.w, spec.h)
  const toBlob = (c: HTMLCanvasElement, type: string, q: number) => new Promise<Blob | null>((r) => c.toBlob(r, type, q))
  try {
    // Try full size first, then step the dimensions down if quality alone cannot reach the budget.
    for (const scale of [1, 0.8, 0.6]) {
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(spec.w * scale)
      canvas.height = Math.round(spec.h * scale)
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new ImageProcessError("Your browser could not process the image.")
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
      for (const q of [0.86, 0.74, 0.6, 0.45]) {
        const webp = await toBlob(canvas, "image/webp", q)
        const blob = webp && webp.type === "image/webp" ? webp : await toBlob(canvas, "image/jpeg", q)
        if (blob && blob.size <= spec.maxBytes) return blob
      }
    }
  } finally {
    bitmap.close?.()
  }
  throw new ImageProcessError("File too large. This image could not be shrunk enough; try a simpler picture.")
}
