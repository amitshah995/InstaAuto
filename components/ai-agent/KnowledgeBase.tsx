"use client"

/**
 * Knowledge base panel: the documents, pages and Reel details the agent searches. Shows each source with its status and
 * counts, lets the owner add a pasted document or import one web page, re-index or delete a source, and test what the agent
 * would find for a question (retrieval only: no AI reply, no Instagram message).
 * Who uses it: app/dashboard/ai-agent/knowledge/page.tsx (full) and SetupWizard step 2 (compact).
 * Talks to /api/ai-agent/kb, /kb/reindex and /kb/search. The server never sends the key, only whether one is set.
 */
import { useState } from "react"
import { Loader2, RefreshCw, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ErrorNote, HEADING, apiJson, card, field, ghostBtn, primaryBtn, useApi } from "./shared"

const KIND_LABEL: Record<string, string> = { reel_offer: "Reel offer", reel_caption: "Reel caption", reel_faq: "Reel FAQs", document: "Document", website: "Web page" }
const STATUS_STYLE: Record<string, string> = {
  ready: "bg-accent text-accent-foreground",
  pending: "bg-secondary text-muted-foreground",
  failed: "bg-destructive/10 text-destructive",
}
const STATUS_LABEL: Record<string, string> = { ready: "Ready", pending: "Indexing", failed: "Failed" }

interface Source { id: string; mediaId: string | null; kind: string; title: string; sourceUrl: string | null; status: string; chunkCount: number; embeddedCount: number; error: string | null }
interface Hit { title: string; kind: string; scope: string; score: number; text: string }
interface SearchResult { mode: string; indexed: boolean; fallbackReason: string | null; chunks: Hit[] }

export function KnowledgeBase({ compact = false }: { compact?: boolean }) {
  const { data, error, loading, reload } = useApi<{ sources: Source[]; embeddingConfigured: boolean; retrievalEnabled: boolean }>("/api/ai-agent/kb")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const act = async (id: string, fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    setBusyId(id); setActionError(null)
    const r = await fn()
    setBusyId(null)
    if (!r.ok) setActionError(r.error || "Something went wrong")
    else { toast.success(okMsg); reload() }
  }

  return (
    <div className="space-y-4">
      {!compact && <h2 className={`${HEADING} text-xl font-bold text-foreground`}>Knowledge</h2>}
      <p className="text-sm text-muted-foreground">
        The agent looks up the few passages that match each question and answers only from them. Add price lists, policies or brochures here. PDF upload is not supported yet: paste the text or import a web page instead.
      </p>
      {data && !data.embeddingConfigured && (
        <p role="status" className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground">Smart matching is not switched on for this server, so the agent uses keyword search.</p>
      )}
      {data && !data.retrievalEnabled && <p role="status" className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground">Search is switched off on this server, so the agent reads your Reel details directly.</p>}
      <ErrorNote message={error || actionError} />

      <div className={card}>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Sources</h3>
        {loading && <p className="text-sm text-muted-foreground"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" />Loading...</p>}
        {data && data.sources.length === 0 && <p className="text-sm text-muted-foreground">Nothing indexed yet. Save Reel details in Setup, or add a document below.</p>}
        {data && data.sources.length > 0 && (
          <ul className="divide-y divide-border">
            {data.sources.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{s.title || KIND_LABEL[s.kind]}</p>
                  <p className="text-xs text-muted-foreground">
                    {KIND_LABEL[s.kind] || s.kind} · {s.mediaId ? "One Reel" : "Whole business"} · {s.chunkCount} passages, {s.embeddedCount} with smart matching
                  </p>
                  {s.status === "failed" && s.error && <p className="break-words text-xs text-destructive">{s.error}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[s.status] || STATUS_STYLE.pending)}>{STATUS_LABEL[s.status] || s.status}</span>
                  <button type="button" className={ghostBtn} disabled={busyId === s.id} aria-label={`Re-index ${s.title || KIND_LABEL[s.kind] || "source"}`} onClick={() => act(s.id, () => apiJson("/api/ai-agent/kb/reindex", { method: "POST", body: JSON.stringify({ id: s.id }) }), "Re-indexed")}>
                    {busyId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Re-index
                  </button>
                  <button type="button" className={ghostBtn} disabled={busyId === s.id} aria-label={`Delete ${s.title}`} onClick={() => confirm(`Delete "${s.title || KIND_LABEL[s.kind] || "this source"}"? The agent will stop using it.`) && act(s.id, () => apiJson(`/api/ai-agent/kb?id=${encodeURIComponent(s.id)}`, { method: "DELETE" }), "Deleted")}>
                    <Trash2 className="h-4 w-4" />Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AddForms onAdded={reload} />
      <SearchTest />
    </div>
  )
}

function AddForms({ onAdded }: { onAdded: () => void }) {
  const [mode, setMode] = useState<"document" | "website">("document")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [url, setUrl] = useState("")
  const [mediaId, setMediaId] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true); setError(null)
    const payload = mode === "document" ? { kind: "document", title, body, mediaId: mediaId.trim() || null } : { kind: "website", url, title: title || undefined, mediaId: mediaId.trim() || null }
    const r = await apiJson("/api/ai-agent/kb", { method: "POST", body: JSON.stringify(payload) })
    setBusy(false)
    if (!r.ok) return setError(r.error || "Could not add")
    toast.success(mode === "document" ? "Document added" : "Page imported")
    setTitle(""); setBody(""); setUrl(""); onAdded()
  }

  return (
    <div className={`${card} space-y-3`}>
      <h3 className="text-sm font-semibold text-foreground">Add knowledge</h3>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kind of knowledge">
        {(["document", "website"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("rounded-lg border px-3 py-1.5 text-sm font-semibold cursor-pointer", mode === m ? "border-brand bg-brand text-brand-foreground" : "border-border bg-card text-foreground hover:bg-secondary")}>
            {m === "document" ? "Paste a document" : "Import one web page"}
          </button>
        ))}
      </div>
      <label className="block text-sm font-medium text-foreground">Title
        <input className={`${field} mt-1`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={mode === "document" ? "Price list" : "Optional, taken from the page"} />
      </label>
      {mode === "document" ? (
        <label className="block text-sm font-medium text-foreground">Text (up to 60,000 characters)
          <textarea className={`${field} mt-1 min-h-32`} value={body} maxLength={60000} onChange={(e) => setBody(e.target.value)} />
        </label>
      ) : (
        <label className="block text-sm font-medium text-foreground">Page address
          <input className={`${field} mt-1`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/offer" inputMode="url" />
          <span className="mt-1 block text-xs font-normal text-muted-foreground">One public https page. Links on it are not followed.</span>
        </label>
      )}
      <label className="block text-sm font-medium text-foreground">Applies to
        <select className={`${field} mt-1`} value={mediaId ? "reel" : "all"} onChange={(e) => setMediaId(e.target.value === "all" ? "" : mediaId || " ")}>
          <option value="all">Whole business</option>
          <option value="reel">One Reel</option>
        </select>
      </label>
      {mediaId !== "" && (
        <label className="block text-sm font-medium text-foreground">Reel media id
          <input className={`${field} mt-1`} value={mediaId.trim()} onChange={(e) => setMediaId(e.target.value.trim() || " ")} placeholder="17900000000000000" inputMode="numeric" />
        </label>
      )}
      <ErrorNote message={error} />
      <button type="button" className={primaryBtn} disabled={busy || (mode === "document" ? !title.trim() || body.trim().length < 20 : !url.trim())} onClick={submit}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "document" ? "Add document" : "Import page"}
      </button>
    </div>
  )
}

function SearchTest() {
  const [query, setQuery] = useState("")
  const [mediaId, setMediaId] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SearchResult | null>(null)

  const run = async () => {
    setBusy(true); setError(null)
    const r = await apiJson<SearchResult>("/api/ai-agent/kb/search", { method: "POST", body: JSON.stringify({ query, mediaId: mediaId.trim() || null }) })
    setBusy(false)
    if (!r.ok) return setError(r.error || "Search failed")
    setResult(r.data)
  }

  return (
    <div className={`${card} space-y-3`}>
      <h3 className="text-sm font-semibold text-foreground">Search test</h3>
      <p className="text-xs text-muted-foreground">See which passages the agent would use for a question. No reply is written and no Instagram message is sent.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className={field} value={query} maxLength={300} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && query.trim() && !busy) run() }} placeholder="How much is the session?" />
        <input className={`${field} sm:w-56`} value={mediaId} onChange={(e) => setMediaId(e.target.value)} placeholder="Reel media id (optional)" inputMode="numeric" />
        <button type="button" className={primaryBtn} disabled={busy || !query.trim()} onClick={run}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Search</button>
      </div>
      <ErrorNote message={error} />
      {result && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {result.chunks.length === 0 ? (result.indexed ? "No passage matched. The agent would hand this question to you." : "Nothing is indexed yet.") : `${result.chunks.length} passage${result.chunks.length === 1 ? "" : "s"} found by ${result.mode === "vector" ? "smart matching" : "keyword search"}.`}
            {result.fallbackReason ? ` ${result.fallbackReason}.` : ""}
          </p>
          {result.chunks.map((c, i) => (
            <div key={i} className="rounded-xl border border-border p-3">
              <p className="text-xs font-semibold text-foreground">{c.title} <span className="font-normal text-muted-foreground">· {KIND_LABEL[c.kind] || c.kind} · {c.scope} · match {c.score}</span></p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{c.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
