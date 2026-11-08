/**
 * Unicode-aware, whole-word keyword matching for comment, DM and story triggers.
 *
 * Who calls this: app/api/instagram/webhook/route.ts (all keyword triggers) and
 * lib/flows/engine.ts (condition-node branches, also used by the in-browser simulator, so this
 * file must stay free of Node-only imports).
 * Why it exists: the old matcher used the ASCII-only `\b` regex boundary, which silently fails
 * for Devanagari and every other non-Latin script (and treated "price?!" or "PRICE" unevenly
 * across scripts). This version normalises both sides identically and compares whole tokens.
 *
 * Pipeline: NFKC normalise -> pull emoji out as their own tokens -> drop zero-width / invisible
 * characters -> lowercase -> split into words on anything that is not a letter, mark or digit
 * (\p{L}\p{M}\p{N}); scripts written without spaces (Chinese, Japanese, Thai...) are split with
 * Intl.Segmenter when the runtime has it. A keyword matches when its token sequence appears
 * contiguously in the text tokens (so "free guide" matches "get the free guide now" but "fre"
 * does not match "free" and "price" does not match "priceless").
 *
 * Behaviour change vs the old regex, on purpose: an empty keyword (for example the gap in "a,,b")
 * now matches NOTHING; before, it matched every message.
 */
import { ALIAS_GROUPS } from "./aliases.ts"

// Extended_Pictographic clusters: base emoji plus optional VS16, skin tone, keycap and ZWJ joins.
const EMOJI_RE = /\p{Extended_Pictographic}(?:️|⃣|[\u{1F3FB}-\u{1F3FF}]|‍\p{Extended_Pictographic})*/gu
// Invisible characters that break matching: zero-width space/joiners, word joiner, BOM, soft hyphen, bidi marks.
const INVISIBLE_RE = /[​-‏‪-‮⁠-⁤﻿­]/g
const WORD_RE = /[\p{L}\p{M}\p{N}]+/gu
// Scripts that are not space-separated and need dictionary segmentation to find word boundaries.
const UNSPACED_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u

type SegmenterCtor = new (locale?: string, opts?: { granularity: "word" }) => { segment(s: string): Iterable<{ segment: string; isWordLike?: boolean }> }
const Segmenter: SegmenterCtor | undefined = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter
const wordSegmenter = Segmenter ? new Segmenter(undefined, { granularity: "word" }) : null

/** Normalises an emoji so 👍, 👍🏽 and ❤️ / ❤ compare equal regardless of tone or variation selector. */
function normalizeEmoji(e: string): string {
  return e.replace(/[️⃣\u{1F3FB}-\u{1F3FF}]/gu, "")
}

function wordsFrom(piece: string): string[] {
  const out: string[] = []
  for (const run of piece.match(WORD_RE) ?? []) {
    if (wordSegmenter && UNSPACED_RE.test(run)) {
      for (const seg of wordSegmenter.segment(run)) if (seg.isWordLike) out.push(seg.segment)
    } else {
      out.push(run)
    }
  }
  return out
}

/** Splits text into comparable lowercase tokens (words and emoji). Pure and deterministic. */
export function tokenize(input: string): string[] {
  if (!input) return []
  const text = input.normalize("NFKC")
  const tokens: string[] = []
  let last = 0
  // Emoji are carved out BEFORE invisible characters are removed, because ZWJ glues emoji sequences together.
  for (const m of text.matchAll(EMOJI_RE)) {
    const idx = m.index ?? 0
    tokens.push(...wordsFrom(text.slice(last, idx).replace(INVISIBLE_RE, "").toLowerCase()))
    tokens.push(normalizeEmoji(m[0]))
    last = idx + m[0].length
  }
  tokens.push(...wordsFrom(text.slice(last).replace(INVISIBLE_RE, "").toLowerCase()))
  return tokens
}

/** Canonical form for debugging and tests: tokens joined by single spaces. */
export function normalizeForMatch(input: string): string {
  return tokenize(input).join(" ")
}

function containsSequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer
    return true
  }
  return false
}

export interface MatchOptions {
  /**
   * Synonym groups. undefined = use ALIAS_GROUPS only when env KEYWORD_ALIASES=1; false = never; an array = use it.
   * Hook for Hinglish ("price" | "rate" | "kitna" | "daam").
   */
  aliases?: string[][] | boolean
}

// Normalised alias groups are cached because the webhook calls this for every rule on every event.
const aliasCache = new WeakMap<string[][], string[][][]>()
function normalisedGroups(groups: string[][]): string[][][] {
  let hit = aliasCache.get(groups)
  if (!hit) {
    hit = groups.map((g) => g.map(tokenize).filter((t) => t.length > 0))
    aliasCache.set(groups, hit)
  }
  return hit
}

function resolveGroups(opts?: MatchOptions): string[][] | null {
  const a = opts?.aliases
  if (Array.isArray(a)) return a
  if (a === false) return null
  if (a === true) return ALIAS_GROUPS
  return typeof process !== "undefined" && process.env?.KEYWORD_ALIASES === "1" ? ALIAS_GROUPS : null
}

/** All token sequences a keyword may match: itself plus its alias-group siblings. */
function expand(keywordTokens: string[], groups: string[][] | null): string[][] {
  if (!groups) return [keywordTokens]
  const key = keywordTokens.join(" ")
  for (const g of normalisedGroups(groups)) {
    if (g.some((member) => member.join(" ") === key)) return g
  }
  return [keywordTokens]
}

/** True when `keyword` (one word or phrase) appears in `text` as whole words. */
export function textMatchesKeyword(text: string, keyword: string, opts?: MatchOptions): boolean {
  const kw = tokenize(keyword)
  if (kw.length === 0) return false // empty keyword matches nothing (see header)
  const haystack = tokenize(text)
  return expand(kw, resolveGroups(opts)).some((variant) => containsSequence(haystack, variant))
}

/** Rule keywords are stored as a comma-separated list; true when ANY of them matches. */
export function matchesAnyKeyword(text: string, commaList: string | null | undefined, opts?: MatchOptions): boolean {
  if (!commaList) return false
  const haystack = tokenize(text)
  if (haystack.length === 0) return false
  const groups = resolveGroups(opts)
  return commaList.split(",").some((raw) => {
    const kw = tokenize(raw)
    return kw.length > 0 && expand(kw, groups).some((variant) => containsSequence(haystack, variant))
  })
}
