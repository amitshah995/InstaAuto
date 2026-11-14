export const emitted: Array<{ userId: any; event: string; data: any; opts: any }> = []
export async function emitEvent(userId: any, event: string, data: any, opts: any = {}) { emitted.push({ userId, event, data, opts }) }
export const storeSecret = (s: string) => `enc:${s}`
export async function sendTest() { throw new Error("must not be called by the simulation") }
