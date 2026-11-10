/**
 * Contact variables for flows: reading what we know about a person, and saving a value the flow sets.
 *
 * Who calls this: lib/messaging/flow-runner.ts (before walking a flow: loadContactFacts; for a "set variable" node:
 * saveContactVariable), tests/batch1-conditions.test.ts (the pure parts).
 * Why it exists: flow conditions can test variables ("budget is over 5000", "source is ref:summer") and a flow can save
 * the person's answer. Variables are the contact's standard fields (name, email, phone) plus contacts.custom_fields
 * (answers from lead-capture questions, `source`, values saved by a set-variable node), so there is no new table.
 */
import { applyTagChange, cleanTag } from "./segments.ts"
import { normalizeVarName } from "../flows/conditions.ts"

const STANDARD_FIELDS = ["name", "email", "phone"] as const

export interface ContactRow {
  name?: string | null
  email?: string | null
  phone?: string | null
  custom_fields?: Record<string, unknown> | null
  tags?: unknown
}

/** Pure: flat string map of everything we know. custom_fields keys are lowercased/normalised, values stringified. */
export function contactToVariables(c: ContactRow | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!c) return out
  for (const f of STANDARD_FIELDS) {
    const v = c[f]
    if (typeof v === "string" && v.trim()) out[f] = v.trim()
  }
  for (const [k, v] of Object.entries(c.custom_fields ?? {})) {
    const key = normalizeVarName(k)
    if (!key || v == null || typeof v === "object") continue
    out[key] = String(v)
  }
  return out
}

/** Pure: where a variable is stored. name/email/phone are real columns, anything else goes into custom_fields. */
export function applyVariable(
  existing: ContactRow | null | undefined,
  rawName: string,
  value: string,
): { columns: Partial<Record<"name" | "email" | "phone", string>>; custom_fields: Record<string, unknown> } | null {
  const name = normalizeVarName(rawName)
  if (!name || name === "last_reply") return null
  const custom_fields: Record<string, unknown> = { ...(existing?.custom_fields ?? {}) }
  if ((STANDARD_FIELDS as readonly string[]).includes(name)) return { columns: { [name]: value } as any, custom_fields }
  custom_fields[name] = value
  return { columns: {}, custom_fields }
}

export async function loadContactFacts(supabase: any, userId: number, igsid: string): Promise<{ variables: Record<string, string>; tags: string[] }> {
  try {
    const { data } = await supabase.from("contacts").select("name, email, phone, custom_fields, tags").eq("user_id", userId).eq("igsid", igsid).single()
    return { variables: contactToVariables(data), tags: Array.isArray(data?.tags) ? data.tags.filter((t: unknown) => typeof t === "string") : [] }
  } catch {
    return { variables: {}, tags: [] }
  }
}

/** Saves one variable on the contact (creating the contact if needed). Never throws; returns true when written. */
export async function saveContactVariable(supabase: any, userId: number, igsid: string, name: string, value: string): Promise<boolean> {
  try {
    const { data: existing } = await supabase.from("contacts").select("id, custom_fields").eq("user_id", userId).eq("igsid", igsid).single()
    const applied = applyVariable(existing, name, value)
    if (!applied) return false
    const now = new Date().toISOString()
    const payload: any = { updated_at: now, custom_fields: applied.custom_fields, ...applied.columns }
    if (existing) {
      const { error } = await supabase.from("contacts").update(payload).eq("id", existing.id)
      return !error
    }
    const { error } = await supabase.from("contacts").insert({ user_id: userId, igsid, created_at: now, ...payload })
    return !error
  } catch (e) {
    console.error("[flow] set variable failed:", e)
    return false
  }
}

/** Removes a tag from a contact. A contact that does not exist or does not have the tag is fine (returns true). Never throws. */
export async function removeTagFromContact(supabase: any, userId: number, igsid: string, rawTag: string): Promise<boolean> {
  const tag = cleanTag(rawTag)
  if (!tag) return false
  try {
    const { data: existing } = await supabase.from("contacts").select("id, tags").eq("user_id", userId).eq("igsid", igsid).single()
    if (!existing) return true
    const { error } = await supabase.from("contacts").update({ tags: applyTagChange(existing.tags, [], [tag]), updated_at: new Date().toISOString() }).eq("id", existing.id)
    return !error
  } catch (e) {
    console.error("[flow] remove tag failed:", e)
    return false
  }
}
