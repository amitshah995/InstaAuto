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
