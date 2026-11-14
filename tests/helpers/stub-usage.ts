export const quota = { allowed: true, calls: 0 }
export async function reserveAgentTurn() { quota.calls++; return quota.allowed ? { allowed: true } : { allowed: false, message: "limit" } }
