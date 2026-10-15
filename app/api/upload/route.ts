import { type NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { authorizeUser } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const formData: any = await request.formData()
    const file = formData.get("file") as File | null
    const auth = authorizeUser(request, formData.get("userId") as string | null)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const userId = auth.userId

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 })
    }

    // userId becomes a directory name: only digits allowed (blocks "../" path traversal)
    if (!/^\d+$/.test(userId)) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Set up local storage path inside the Next.js public directory
    const uploadDir = path.join(process.cwd(), "public", "uploads", userId)
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    // Sanitize filename to avoid folder traversal attacks or bad characters
    const sanitizedFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`
    const filePath = path.join(uploadDir, sanitizedFileName)

    // Write buffer to local public directory
    fs.writeFileSync(filePath, buffer)

    // Generate local public URL served statically by Next.js
    const publicUrl = `${request.nextUrl.origin}/uploads/${userId}/${sanitizedFileName}`

    return NextResponse.json({ publicUrl })
  } catch (error: any) {
    console.error("[Local Upload API Error]:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
