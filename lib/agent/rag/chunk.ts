/**
 * Splitting knowledge into chunks. Pure, no I/O.
 *
 * Who calls this: lib/agent/rag/service.ts when a Reel's knowledge is saved, a document is pasted or a page is imported.
 * Why: retrieval works on small passages, so long text is cut at paragraph then sentence boundaries into ~600-900 character
 * pieces with a small overlap; an FAQ question and its answer stay in one chunk so an answer never loses its question.
 * Safe for Hindi/Devanagari: lengths are counted in code points (not UTF-16 units) and sentence ends include the danda.
 */
import type { Faq, Knowledge } from "../types.ts"

export const CHUNK_TARGET = 800
export const CHUNK_MAX = 900
export const CHUNK_OVERLAP = 100
export const MAX_CHUNKS_PER_SOURCE = 200
export const MAX_SOURCE_CHARS = 60_000
/** An FAQ chunk may be a bit longer than a normal chunk so Q and A stay together. */
export const FAQ_CHUNK_MAX = 1500

export interface Chunk { content: string; tokenEstimate: number }

const cps = (s: string) => Array.from(s)
const len = (s: string) => cps(s).length

/** Rough token estimate (about 3 characters per token, pessimistic for Hindi). Used for display and cost hints only. */
export function estimateTokens(s: string): number {
  return Math.ceil(len(s) / 3)
}

/** Collapses runs of spaces/tabs, keeps paragraph breaks, strips control characters. */
export function normalizeText(raw: unknown): string {
  return String(raw ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Sentences, keeping the ending punctuation (. ! ? and the Devanagari danda and double danda). */
export function splitSentences(paragraph: string): string[] {
  const out = paragraph.match(/[^.!?।॥\n]+(?:[.!?।॥]+["')\]]*|\n|$)/g) ?? [paragraph]
  return out.map((s) => s.trim()).filter(Boolean)
}

/** Hard-splits a run of text with no sentence ends at word boundaries (last resort). */
function splitWords(text: string, max: number): string[] {
  const out: string[] = []
  let cur = ""
  for (const w of text.split(/\s+/)) {
    if (len(w) > max) {
      if (cur) { out.push(cur); cur = "" }
      const chars = cps(w)
      for (let i = 0; i < chars.length; i += max) out.push(chars.slice(i, i + max).join(""))
      continue
    }
    if (cur && len(cur) + 1 + len(w) > max) { out.push(cur); cur = w } else cur = cur ? `${cur} ${w}` : w
  }
  if (cur) out.push(cur)
  return out
}

/** The last `n` characters of text, starting at a word boundary, used as the overlap that opens the next chunk. */
function tail(text: string, n: number): string {
  const chars = cps(text)
  if (chars.length <= n) return ""
  const t = chars.slice(chars.length - n).join("")
  const sp = t.indexOf(" ")
  return sp >= 0 && sp < t.length - 1 ? t.slice(sp + 1) : t
}

/**
 * Long text -> chunks of about CHUNK_TARGET characters (never above CHUNK_MAX, except none), with CHUNK_OVERLAP characters of
 * overlap between neighbours. Empty or whitespace-only text gives []. Input is cut at MAX_SOURCE_CHARS and output at
 * MAX_CHUNKS_PER_SOURCE so one huge paste cannot create unbounded rows or embedding cost.
 */
export function chunkText(raw: string, opts: { target?: number; max?: number; overlap?: number; maxChunks?: number } = {}): Chunk[] {
  const target = opts.target ?? CHUNK_TARGET
  const max = opts.max ?? CHUNK_MAX
  const overlap = opts.overlap ?? CHUNK_OVERLAP
  const maxChunks = opts.maxChunks ?? MAX_CHUNKS_PER_SOURCE
  const text = normalizeText(cps(String(raw ?? "")).slice(0, MAX_SOURCE_CHARS).join(""))
  if (!text) return []

  // Units: whole paragraphs when short, otherwise sentences, otherwise word runs. Every unit is <= max.
  const units: string[] = []
  for (const para of text.split(/\n\n+/)) {
    const p = para.replace(/\n/g, " ").trim()
    if (!p) continue
    if (len(p) <= max) { units.push(p); continue }
    for (const s of splitSentences(p)) {
      if (len(s) <= max) units.push(s)
      else units.push(...splitWords(s, max))
    }
  }

  const chunks: string[] = []
  let cur = ""
  const flush = () => { if (cur.trim()) chunks.push(cur.trim()) }
  for (const u of units) {
    if (!cur) { cur = u; continue }
    if (len(cur) + 1 + len(u) <= target) { cur = `${cur} ${u}`; continue }
    const carry = tail(cur, overlap)
    flush()
    cur = carry && len(carry) + 1 + len(u) <= max ? `${carry} ${u}` : u
    if (chunks.length >= maxChunks) break
  }
  if (chunks.length < maxChunks) flush()
  return chunks.slice(0, maxChunks).map((content) => ({ content, tokenEstimate: estimateTokens(content) }))
}

/**
 * FAQs -> one chunk per FAQ ("Q: ...\nA: ..."). An FAQ longer than FAQ_CHUNK_MAX is split in the ANSWER only, and the question is
 * repeated at the top of every piece, so each piece still answers "what was asked".
 */
export function chunkFaqs(faqs: Faq[], maxChunks = MAX_CHUNKS_PER_SOURCE): Chunk[] {
  const out: Chunk[] = []
  for (const f of faqs) {
    const q = normalizeText(f?.q).replace(/\n/g, " ")
    const a = normalizeText(f?.a)
    if (!q || !a) continue
    const head = `Q: ${q}\nA: `
    const whole = `${head}${a}`
    if (len(whole) <= FAQ_CHUNK_MAX) {
      out.push({ content: whole, tokenEstimate: estimateTokens(whole) })
    } else {
      const room = Math.max(200, FAQ_CHUNK_MAX - len(head))
      for (const piece of splitWords(a.replace(/\n/g, " "), room)) {
        const c = `${head}${piece}`
        out.push({ content: c, tokenEstimate: estimateTokens(c) })
      }
    }
    if (out.length >= maxChunks) break
  }
  return out.slice(0, maxChunks)
}

export type ReelSourceKind = "reel_offer" | "reel_caption" | "reel_faq"
export interface SourcePlan { kind: ReelSourceKind; title: string; chunks: Chunk[] }

/**
 * A Reel's knowledge -> the three sources we index (offer, caption, FAQs). Empty parts produce a plan with no chunks, which
 * the ingest step uses to delete that source's old chunks (so clearing the offer removes it from search).
 */
export function planReelSources(k: Knowledge): SourcePlan[] {
  const label = k.title?.trim() || "Reel"
  return [
    { kind: "reel_offer", title: `${label}: offer`, chunks: chunkText(k.offer) },
    { kind: "reel_caption", title: `${label}: caption`, chunks: chunkText(k.caption) },
    { kind: "reel_faq", title: `${label}: FAQs`, chunks: chunkFaqs(k.faqs) },
  ]
}
