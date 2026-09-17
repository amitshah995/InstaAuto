import { type NextRequest } from "next/server"

export function getSessionUserId(request: NextRequest): string | null {
  const raw = request.cookies.get("insta_session")?.value
  if (!raw) return null
  try {
    const session = JSON.parse(raw)
    return session?.userId ? String(session.userId) : null
  } catch {
    return null
  }
}
