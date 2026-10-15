import { NextResponse } from "next/server"
import { SESSION_COOKIE } from "@/lib/session"

// The signed session cookie is httpOnly, so the browser cannot clear it from JS.
export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  })
  return response
}
