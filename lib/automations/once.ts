/**
 * "Send only once per person per post" for comment automations.
 *
 * Stored on the rule as response_content.once_per_person (no migration needed).
 * The claim is one row in processed_events (unique event_id), so it is atomic: two comments
 * arriving at the same time cannot both pass.
 */

/** True only when the rule explicitly opted in. Existing rules keep their current behaviour. */
export function isOncePerPerson(content: unknown): boolean {
  return !!content && typeof content === "object" && (content as any).once_per_person === true
}

/**
 * Key for one (rule, person, post) combination. Different posts, different people and
 * different rules never collide. Parts are length-prefixed so "a|b" + "c" can't equal "a" + "b|c".
 */
export function onceKey(automationId: string, senderId: string, mediaId: string): string {
  const part = (v: string) => `${String(v).length}:${v}`
  return `once_${part(automationId)}_${part(senderId)}_${part(mediaId)}`
}
