import { test } from "node:test"
import assert from "node:assert/strict"
import { classifyStorageError } from "../lib/shop/storage-errors.ts"
import { coverCrop } from "../lib/shop/compress.ts"

// The production bug: Supabase answers a missing bucket with HTTP 400 and the 404 only in the JSON body.
test("missing bucket is recognised even when the HTTP status is 400", () => {
  const body = JSON.stringify({ statusCode: "404", error: "Bucket not found", message: "Bucket not found" })
  assert.equal(classifyStorageError(400, body), "bucket_missing")
  assert.equal(classifyStorageError(404, body), "bucket_missing")
})

test("auth, size, type and unknown failures map to their own codes", () => {
  assert.equal(classifyStorageError(403, JSON.stringify({ message: "new row violates row-level security policy" })), "storage_auth")
  assert.equal(classifyStorageError(401, "Invalid Compact JWS"), "storage_auth")
  assert.equal(classifyStorageError(413, JSON.stringify({ statusCode: "413", error: "Payload too large" })), "too_large")
  assert.equal(classifyStorageError(415, JSON.stringify({ message: "mime type text/plain is not supported" })), "bad_type")
  assert.equal(classifyStorageError(500, "boom"), "storage_failed")
})

test("coverCrop takes the centred region with the target aspect ratio", () => {
  // 4000x3000 photo -> 1800x400 banner (4.5:1): full width, 889px tall band from the middle.
  const c = coverCrop(4000, 3000, 1800, 400)
  assert.equal(c.sx, 0); assert.equal(c.sw, 4000); assert.equal(c.sh, 889); assert.equal(c.sy, Math.round((3000 - 889) / 2))
  // Wide photo -> square avatar: full height, centred width.
  const a = coverCrop(2000, 1000, 512, 512)
  assert.deepEqual(a, { sx: 500, sy: 0, sw: 1000, sh: 1000 })
})
