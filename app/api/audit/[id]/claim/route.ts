import { NextResponse } from "next/server"

// Retired. Reports are now created by the signed-in owner (POST /api/audit), so there is nothing to claim.
// Kept as a stub so deployments that still have this file keep building.
export async function POST() {
  return NextResponse.json({ error: "This endpoint was retired. Run your audit from /instagram-audit." }, { status: 410 })
}
