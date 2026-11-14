// Test-only module hooks: resolves the "@/..." alias and swaps the I/O modules lib/agent/runtime.ts imports for stubs.
import { pathToFileURL, fileURLToPath } from "node:url"
import path from "node:path"
import fs from "node:fs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const stubs = {
  "@/lib/supabase-server": "tests/helpers/stub-db.ts",
  "@/lib/messaging/send-steps": "tests/helpers/stub-send.ts",
  "@/lib/billing/usage": "tests/helpers/stub-usage.ts",
  "@/lib/webhooks/events": "tests/helpers/stub-events.ts",
}

export async function resolve(specifier, context, nextResolve) {
  if (stubs[specifier]) return { url: pathToFileURL(path.join(root, stubs[specifier])).href, shortCircuit: true }
  if (/^next\/[a-z-]+$/.test(specifier)) return nextResolve(specifier + ".js", context) // ESM needs the extension
  if (specifier.startsWith("@/")) {
    const base = path.join(root, specifier.slice(2))
    for (const ext of [".ts", ".tsx", "/index.ts", ""]) {
      if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return { url: pathToFileURL(base + ext).href, shortCircuit: true }
    }
  }
  return nextResolve(specifier, context)
}
