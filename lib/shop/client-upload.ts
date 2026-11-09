import { prepareShopImage, ImageProcessError, type ShopImageKind } from "@/lib/shop/compress"

/** Browser-side upload: shrink, POST to /api/shop/upload, and turn every failure into one specific sentence. */
export async function uploadShopImage(file: File, kind: ShopImageKind): Promise<string> {
  let blob: Blob
  try {
    blob = await prepareShopImage(file, kind)
  } catch (e) {
    throw new Error(e instanceof ImageProcessError ? e.message : "We could not process that image.")
  }
  const fd = new FormData()
  fd.append("file", blob, kind)
  let res: Response
  try {
    res = await fetch("/api/shop/upload", { method: "POST", body: fd })
  } catch {
    throw new Error("Network problem while uploading. Check your connection and try again.")
  }
  const json = await res.json().catch(() => ({}) as any)
  if (res.ok && json.url) return json.url as string
  // Vercel answers an oversized body with a non-JSON 413 before our route runs.
  if (res.status === 413 && !json.error) throw new Error("File too large. Choose a smaller image.")
  if (res.status === 401) throw new Error("Not signed in. Please sign in again and retry.")
  throw new Error(json.error || "Image upload failed. Please try again.")
}
