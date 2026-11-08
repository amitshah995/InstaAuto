/**
 * Parses the webhook retention setting. Who calls it: lib/maintenance.ts.
 * Separate pure file so it is unit-testable without the database module.
 */
/** Parses the retention setting; invalid or too-small values fall back to 30 so we never wipe everything by mistake. */
export function retentionDays(raw: string | undefined = process.env.WEBHOOK_RETENTION_DAYS): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 30
}

