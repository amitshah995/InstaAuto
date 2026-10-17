import { type NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { missingMigrations, shopSchemaStatus } from "@/lib/shop/schema"
import { storageBase } from "@/lib/shop/media"
import { whatsappConfigured } from "@/lib/whatsapp-saas"

// Tells the signed-in owner which setup steps are still missing. Reports only yes/no, never any value.
export async function GET(request: NextRequest) {
  if (!getSessionUserId(request)) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const schema = await shopSchemaStatus()
  const storageEnv = !!storageBase() && !!process.env.SUPABASE_SERVICE_ROLE_KEY
  return NextResponse.json({
    ok: missingMigrations(schema).length === 0 && storageEnv,
    missingMigrations: missingMigrations(schema),
    imageStorageConfigured: storageEnv,
    whatsappConfigured: whatsappConfigured(),
    schema,
  })
}
