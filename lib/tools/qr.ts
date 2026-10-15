/**
 * Minimal QR Code generator (byte mode, error correction level M, versions 1-10).
 * No dependencies. Enough for URLs up to ~210 characters. Returns a square boolean matrix
 * (true = dark module) WITHOUT the quiet zone; the renderer adds the border.
 */

const ECC_PER_BLOCK_M = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const BLOCKS_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
export const QR_MAX_VERSION = 10

function rawModules(ver: number): number {
  let r = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2
    r -= (25 * n - 10) * n - 55
    if (ver >= 7) r -= 36
  }
  return r
}
const dataCodewords = (ver: number) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK_M[ver] * BLOCKS_M[ver]

function alignPositions(ver: number): number[] {
  if (ver === 1) return []
  const n = Math.floor(ver / 7) + 2
  const size = ver * 4 + 17
  const step = Math.ceil((ver * 8 + 8) / (n * 2 - 2) / 2) * 2
  const out = [6]
  for (let pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos)
  return out
}

// ---- Reed-Solomon over GF(256), polynomial 0x11D
function gfMul(a: number, b: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((b >>> i) & 1) * a
  }
  return z
}
function rsDivisor(degree: number): number[] {
  const res = new Array(degree).fill(0)
  res[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      res[j] = gfMul(res[j], root)
      if (j + 1 < degree) res[j] ^= res[j + 1]
    }
    root = gfMul(root, 0x02)
  }
  return res
}
function rsRemainder(data: number[], divisor: number[]): number[] {
  const res = new Array(divisor.length).fill(0)
  for (const b of data) {
    const f = b ^ (res.shift() as number)
    res.push(0)
    divisor.forEach((c, i) => { res[i] ^= gfMul(c, f) })
  }
  return res
}

function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text))
}

export function qrMatrix(text: string): boolean[][] {
  const bytes = utf8(text)
  let ver = 1
  for (; ver <= QR_MAX_VERSION; ver++) {
    const countBits = ver < 10 ? 8 : 16
    if (4 + countBits + bytes.length * 8 <= dataCodewords(ver) * 8) break
  }
  if (ver > QR_MAX_VERSION) throw new Error("Text is too long for this QR generator")

  // ---- bit stream
  const bits: number[] = []
  const push = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1) }
  push(0b0100, 4)
  push(bytes.length, ver < 10 ? 8 : 16)
  bytes.forEach((b) => push(b, 8))
  const capBits = dataCodewords(ver) * 8
  push(0, Math.min(4, capBits - bits.length))
  push(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capBits; pad ^= 0xec ^ 0x11) push(pad, 8)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2))

  // ---- error correction + interleave
  const nBlocks = BLOCKS_M[ver], eccLen = ECC_PER_BLOCK_M[ver]
  const raw = Math.floor(rawModules(ver) / 8)
  const nShort = nBlocks - (raw % nBlocks)
  const shortLen = Math.floor(raw / nBlocks)
  const blocks: number[][] = []
  const div = rsDivisor(eccLen)
  for (let i = 0, k = 0; i < nBlocks; i++) {
    const len = shortLen - eccLen + (i < nShort ? 0 : 1)
    const dat = data.slice(k, k + len)
    k += len
    const ecc = rsRemainder(dat, div)
    if (i < nShort) dat.push(0)
    blocks.push(dat.concat(ecc))
  }
  const codewords: number[] = []
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((blk, j) => {
      if (i !== shortLen - eccLen || j >= nShort) codewords.push(blk[i])
    })
  }

  // ---- draw
  const size = ver * 4 + 17
  const mod: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false))
  const fn: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false))
  const setFn = (x: number, y: number, dark: boolean) => { mod[y][x] = dark; fn[y][x] = true }

  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0) }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy
      if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, d !== 2 && d !== 4)
    }
  }
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4)
  const ap = alignPositions(ver)
  ap.forEach((ax, i) => ap.forEach((ay, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
  }))

  const drawFormat = (mask: number) => {
    const d = (0 << 3) | mask // ECC level M = 0b00
    let rem = d
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const b = ((d << 10) | rem) ^ 0x5412
    const bit = (i: number) => ((b >>> i) & 1) !== 0
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i))
    setFn(8, 7, bit(6)); setFn(8, 8, bit(7)); setFn(7, 8, bit(8))
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i))
    setFn(8, size - 8, true)
  }
  drawFormat(0) // reserve format area before placing data
  if (ver >= 7) {
    let rem = ver
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const b = (ver << 12) | rem
    for (let i = 0; i < 18; i++) {
      const bit = ((b >>> i) & 1) !== 0, a = size - 11 + (i % 3), c = Math.floor(i / 3)
      setFn(a, c, bit); setFn(c, a, bit)
    }
  }

  // zigzag data placement
  let k = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert
        if (!fn[y][x] && k < codewords.length * 8) {
          mod[y][x] = ((codewords[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0
          k++
        }
      }
    }
  }

  const maskFn = [
    (x: number, y: number) => (x + y) % 2 === 0,
    (_x: number, y: number) => y % 2 === 0,
    (x: number) => x % 3 === 0,
    (x: number, y: number) => (x + y) % 3 === 0,
    (x: number, y: number) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ]
  const applyMask = (m: number) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFn[m](x, y)) mod[y][x] = !mod[y][x]
  }

  const penalty = (): number => {
    let p = 0
    const lines: string[] = []
    for (let y = 0; y < size; y++) lines.push(mod[y].map((v) => (v ? "1" : "0")).join(""))
    for (let x = 0; x < size; x++) lines.push(mod.map((r) => (r[x] ? "1" : "0")).join(""))
    for (const l of lines) {
      let run = 1
      for (let i = 1; i <= l.length; i++) {
        if (i < l.length && l[i] === l[i - 1]) run++
        else { if (run >= 5) p += 3 + (run - 5); run = 1 }
      }
      for (const pat of ["10111010000", "00001011101"]) {
        let at = l.indexOf(pat)
        while (at !== -1) { p += 40; at = l.indexOf(pat, at + 1) }
      }
    }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const c = mod[y][x]
      if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3
    }
    const dark = mod.reduce((a, r) => a + r.filter(Boolean).length, 0)
    const total = size * size
    p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10
    return p
  }

  let best = 0, bestPen = Infinity
  for (let m = 0; m < 8; m++) {
    applyMask(m); drawFormat(m)
    const pen = penalty()
    if (pen < bestPen) { best = m; bestPen = pen }
    applyMask(m) // undo
  }
  applyMask(best); drawFormat(best)
  return mod
}

/** Renders the matrix to an SVG string (with a 4-module quiet zone). */
export function qrSvg(text: string, px = 256, dark = "#000000", light = "#ffffff"): string {
  const m = qrMatrix(text)
  const n = m.length + 8
  let d = ""
  m.forEach((row, y) => row.forEach((v, x) => { if (v) d += `M${x + 4},${y + 4}h1v1h-1z` }))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`
}
