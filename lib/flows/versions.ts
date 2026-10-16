import { getSupabaseServerClient, rawQuery } from "@/lib/supabase-server"

export const MAX_VERSIONS = 10

/**
 * Saves the CURRENT state of an automation as a version before it is overwritten.
 * Best-effort: if the table is missing or the insert fails, editing must still work.
 */
export async function snapshotAutomation(automationId: string, ownerId: string | number | null): Promise<void> {
  try {
    const supabase = await getSupabaseServerClient()
    let q = supabase.from("automations").select("id, user_id, name, trigger_value, response_content").eq("id", automationId)
    if (ownerId) q = q.eq("user_id", ownerId)
    const { data: cur } = await q.single()
    if (!cur?.response_content) return
    const { error } = await supabase.from("automation_versions").insert({
      automation_id: cur.id,
      user_id: cur.user_id,
      name: cur.name,
      trigger_value: cur.trigger_value,
      response_content: cur.response_content,
    })
    if (error) return
    await rawQuery(
      `DELETE FROM automation_versions WHERE automation_id = $1 AND id NOT IN (
         SELECT id FROM automation_versions WHERE automation_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2)`,
      [automationId, MAX_VERSIONS],
    )
  } catch (e) {
    console.warn("[versions] snapshot skipped:", (e as Error)?.message)
  }
}
