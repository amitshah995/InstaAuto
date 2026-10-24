import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { rawQuery } from "@/lib/supabase-server"
import { getFollowerSeries, getReportStats } from "@/lib/reports"
import { FollowerChart } from "@/components/reports/FollowerChart"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Instagram growth report", robots: { index: false, follow: false } }

export default async function PublicReport({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let row: { user_id: number; title: string | null; username: string | null } | undefined
  try {
    const rows = await rawQuery<{ user_id: number; title: string | null; username: string | null }>(
      `SELECT r.user_id, r.title, u.username FROM report_shares r JOIN users u ON u.id = r.user_id WHERE r.slug = $1 AND r.enabled = TRUE`,
      [slug],
    )
    row = rows[0]
  } catch {
    notFound()
  }
  if (!row) notFound()

  const [series, stats] = await Promise.all([getFollowerSeries(row.user_id, 30), getReportStats(row.user_id, 30)])
  const first = series[0]?.followers
  const last = series[series.length - 1]?.followers
  const delta = first !== undefined && last !== undefined ? last - first : null

  const tiles = [
    { label: "Comments matched", value: stats.commentsMatched },
    { label: "DMs sent", value: stats.dmsSent },
    { label: "Link clicks", value: stats.linkClicks },
    { label: "New contacts", value: stats.contacts },
  ]

  return (
    <main className="min-h-screen font-sans bg-gradient-to-br from-fuchsia-50 via-white to-orange-50 px-4 py-10 text-neutral-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-600">Last 30 days</p>
          <h1 className="text-2xl font-bold sm:text-3xl">{row.title || `Instagram report${row.username ? ` · @${row.username}` : ""}`}</h1>
        </header>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-sm text-neutral-500">Followers</p>
              <p className="text-3xl font-bold">{last !== undefined ? last.toLocaleString("en-IN") : "—"}</p>
            </div>
            {delta !== null && (
              <p className={`text-sm font-semibold ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {delta >= 0 ? "+" : ""}
                {delta.toLocaleString("en-IN")} in {series.length} days
              </p>
            )}
          </div>
          <FollowerChart data={series} />
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-2xl font-bold">{t.value.toLocaleString("en-IN")}</p>
              <p className="text-xs text-neutral-500">{t.label}</p>
            </div>
          ))}
        </section>

        <p className="text-center text-xs text-neutral-400">Live numbers from the connected Instagram account. No personal data of followers is shown.</p>
      </div>
    </main>
  )
}
