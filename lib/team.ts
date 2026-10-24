import crypto from "crypto"
import { type NextRequest } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { getVerifiedSessionPayload } from "@/lib/auth"

export const ACTING_SESSION_SECONDS = 2 * 60 * 60 // re-checked against the team list every 2 hours
export const OWN_SESSION_SECONDS = 7 * 24 * 60 * 60

export interface TeamCtx {
  /** The account whose data is shown (the owner while a teammate is acting). */
  accountId: string
  /** The real logged-in person. */
  selfId: string
  acting: boolean
}

export function getTeamCtx(request: NextRequest): TeamCtx | null {
  const p = getVerifiedSessionPayload(request)
  if (!p) return null
  return { accountId: p.uid, selfId: p.mb || p.uid, acting: !!p.mb }
}

export const makeInviteCode = () => crypto.randomBytes(12).toString("base64url")

export async function isMember(ownerId: string, memberId: string): Promise<boolean> {
  const r = await rawQuery(`SELECT 1 FROM team_members WHERE owner_id=$1 AND member_id=$2`, [ownerId, memberId])
  return r.length > 0
}
