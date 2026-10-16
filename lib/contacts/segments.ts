/**
 * Pure helpers for contact tags and segments. Used by the API (validation) and the
 * contacts page (filtering), so both agree on what a tag or a segment means.
 */
import { z } from "zod"

export const MAX_TAGS_PER_CONTACT = 20
export const MAX_TAG_LEN = 30

export function cleanTag(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const t = raw.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_\-ऀ-ॿ]/g, "").slice(0, MAX_TAG_LEN)
  return t.length > 0 ? t : null
}

export function cleanTags(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  const out: string[] = []
  for (const x of list) {
    const t = cleanTag(x)
    if (t && !out.includes(t)) out.push(t)
  }
  return out.slice(0, MAX_TAGS_PER_CONTACT)
}

export function applyTagChange(current: unknown, add: unknown, remove: unknown): string[] {
  const rm = new Set(cleanTags(remove))
  const merged = [...cleanTags(current), ...cleanTags(add)]
  const out: string[] = []
  for (const t of merged) if (!rm.has(t) && !out.includes(t)) out.push(t)
  return out.slice(0, MAX_TAGS_PER_CONTACT)
}

export const SegmentSchema = z.object({
  tagsAny: z.array(z.string()).max(20).optional(),
  tagsAll: z.array(z.string()).max(20).optional(),
  tagsNone: z.array(z.string()).max(20).optional(),
  hasEmail: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
  addedWithinDays: z.number().int().min(1).max(3650).optional(),
  text: z.string().max(100).optional(),
})
export type Segment = z.infer<typeof SegmentSchema>

export type ContactLike = {
  name?: string | null
  email?: string | null
  phone?: string | null
  igsid?: string
  tags?: unknown
  custom_fields?: Record<string, any> | null
  created_at?: string
}

export function matchesSegment(c: ContactLike, seg: Segment, now = Date.now()): boolean {
  const tags = cleanTags(c.tags)
  const any = cleanTags(seg.tagsAny)
  const all = cleanTags(seg.tagsAll)
  const none = cleanTags(seg.tagsNone)
  if (any.length && !any.some((t) => tags.includes(t))) return false
  if (all.length && !all.every((t) => tags.includes(t))) return false
  if (none.length && none.some((t) => tags.includes(t))) return false
  if (seg.hasEmail !== undefined && !!c.email !== seg.hasEmail) return false
  if (seg.hasPhone !== undefined && !!c.phone !== seg.hasPhone) return false
  if (seg.addedWithinDays !== undefined) {
    const t = c.created_at ? new Date(c.created_at).getTime() : NaN
    if (!Number.isFinite(t) || now - t > seg.addedWithinDays * 86400000) return false
  }
  const q = seg.text?.trim().toLowerCase()
  if (q) {
    const hay = [c.name, c.email, c.phone, c.igsid, ...Object.values(c.custom_fields || {})]
    if (!hay.filter(Boolean).some((v) => String(v).toLowerCase().includes(q))) return false
  }
  return true
}

export function allTags(contacts: ContactLike[]): { tag: string; count: number }[] {
  const m = new Map<string, number>()
  for (const c of contacts) for (const t of cleanTags(c.tags)) m.set(t, (m.get(t) || 0) + 1)
  return [...m.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}
