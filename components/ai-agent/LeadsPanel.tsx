"use client"

/**
 * Leads tab: leads captured by the agent with status filters and a CSV download (the existing contacts export with a
 * lead_status filter). Data: GET /api/ai-agent/leads?status=
 */
import { useState } from "react"
import { Download } from "lucide-react"
import { ErrorNote, StatusPill, card, ghostBtn, useApi } from "./shared"

const FILTERS = [
  { id: "", label: "All" }, { id: "wa_lead", label: "WhatsApp" }, { id: "email_lead", label: "Email" },
  { id: "engaged", label: "Engaged" }, { id: "handoff", label: "Handoff" }, { id: "new", label: "New" },
]

export function LeadsPanel() {
  const [status, setStatus] = useState("")
  const { data, error, loading } = useApi<any>(`/api/ai-agent/leads${status ? `?status=${status}` : ""}`)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lead status">
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" aria-selected={status === f.id} onClick={() => setStatus(f.id)} className={`rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer ${status === f.id ? "border-brand bg-brand text-brand-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>{f.label}</button>
          ))}
        </div>
        <a className={ghostBtn} href={`/api/contacts/export?lead_status=${status || "all"}`}><Download className="h-4 w-4" />Download CSV</a>
      </div>
      {error && <ErrorNote message={error} />}
      {loading && !data ? <p className="text-sm text-muted-foreground">Loading...</p> : (
        <div className={`${card} overflow-x-auto p-0 sm:p-0`}>
          {!data?.leads?.length ? <p className="p-4 text-sm text-muted-foreground">No leads here yet.</p> : (
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="px-4 py-2 font-medium">Contact</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Score</th><th className="px-4 py-2 font-medium">Phone / email</th><th className="px-4 py-2 font-medium">Updated</th></tr></thead>
              <tbody>
                {data.leads.map((l: any) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-foreground">{l.username ? `@${l.username}` : l.name || "Contact"}</td>
                    <td className="px-4 py-2"><StatusPill status={l.status} /></td>
                    <td className="px-4 py-2 text-foreground">{l.score}</td>
                    <td className="px-4 py-2 text-muted-foreground">{l.phone || l.email || "-"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{l.updatedAt ? new Date(l.updatedAt).toLocaleDateString("en-IN") : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
