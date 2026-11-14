import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
let pool: any = null
export async function rawQuery(text: string, values: any[] = []) {
  if (!pool) {
    const { Pool } = require("pg")
    pool = new Pool({ host: process.env.QA_PG_HOST, port: Number(process.env.QA_PG_PORT || 5432), user: process.env.QA_PG_USER || "postgres", database: process.env.QA_PG_DB || "qa" })
  }
  return (await pool.query(text, values)).rows
}
export const closePool = async () => { if (pool) await pool.end(); pool = null }
