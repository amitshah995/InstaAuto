"use client"

/**
 * Guided setup for the AI Sales Agent: 1 Connect AiSend (optional), 2 Reel knowledge, 3 Tone/language/handoff/consent,
 * 4 Turn on (creates or links the comment automation). Each step shows done / not done from GET /api/ai-agent/status
 * (rule in lib/agent/wizard.ts). Rendered by app/dashboard/ai-agent/setup/page.tsx.
 */
import { useEffect, useState } from "react"
import { Check, ChevronDown, Circle, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { ErrorNote, HEADING, apiJson, card, field, ghostBtn, primaryBtn, useApi } from "./shared"

type Status = any

function StepShell({ n, title, done, optional, open, onToggle, children }: { n: number; title: string; done: boolean; optional?: boolean; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className={card}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 text-left cursor-pointer">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", done ? "bg-brand text-brand-foreground" : "border border-border bg-secondary text-muted-foreground")}>{done ? <Check className="h-4 w-4" /> : n}</span>
        <span className="flex-1">
          <span className={`${HEADING} block text-base font-semibold text-foreground`}>{title}</span>
          <span className="text-xs text-muted-foreground">{done ? "Done" : "Not done"}{optional ? " · optional" : ""}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-4 border-t border-border pt-4">{children}</div>}
    </section>
  )
}

// ---------- Step 1 ----------
function ConnectorStep({ status, reload }: { status: Status; reload: () => void }) {
  const [baseUrl, setBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const c = useApi<any>("/api/ai-agent/aisend")
  useEffect(() => { if (c.data?.configured) { setBaseUrl(c.data.baseUrl); setEnabled(c.data.enabled) } }, [c.data])

  const save = async () => {
    setBusy(true); setError(null)
    const r = await apiJson("/api/ai-agent/aisend", { method: "PUT", body: JSON.stringify({ baseUrl, apiKey, enabled }) })
    setBusy(false)
    if (!r.ok) return setError(r.error || "Could not save")
    setApiKey("") // the key is never kept in the page after saving
    toast.success("AiSend saved")
    c.reload(); reload()
  }
  const test = async () => {
    setBusy(true); setError(null)
    const r = await apiJson<any>("/api/ai-agent/aisend/test", { method: "POST", body: "{}" })
    setBusy(false)
    if (r.ok && r.data.ok) toast.success("Test lead delivered to AiSend")
    else setError(r.data?.error || r.error || "The test lead was not accepted")
  }
  const skip = async () => {
    await apiJson("/api/ai-agent/settings", { method: "PUT", body: JSON.stringify({ connectorSkipped: true }) })
    reload()
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">When someone agrees to be messaged on WhatsApp, Celra sends the lead to your AiSend account so your brochure message goes out there. You can skip this and still collect leads in Celra.</p>
      <label className="block text-sm font-medium text-foreground">AiSend address
        <input className={`${field} mt-1`} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://your-aisend.example" inputMode="url" autoComplete="off" />
      </label>
      <label className="block text-sm font-medium text-foreground">API key
        <input className={`${field} mt-1`} type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={c.data?.hasKey ? "Saved. Leave blank to keep it." : "Paste the key from your AiSend dashboard"} autoComplete="off" />
      </label>
      <p className="text-xs text-muted-foreground">The key is stored encrypted and is never shown again.</p>
      <label className="flex items-center gap-2 text-sm text-foreground"><Switch checked={enabled} onCheckedChange={setEnabled} /> Send leads to AiSend</label>
      <ErrorNote message={error} />
      <div className="flex flex-wrap gap-2">
        <button className={primaryBtn} onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button>
        <button className={ghostBtn} onClick={test} disabled={busy || !c.data?.configured}>Send test lead</button>
        {!status.wizard.steps[0].done && <button className={ghostBtn} onClick={skip}>Skip for now</button>}
      </div>
      {c.data?.disabledReason && <p className="text-xs text-destructive">Switched off: {c.data.disabledReason}</p>}
    </div>
  )
}

// ---------- Step 2 ----------
interface Faq { q: string; a: string }
interface Draft { mediaId: string; title: string; caption: string; offer: string; faqs: Faq[]; active: boolean }
const emptyDraft = (): Draft => ({ mediaId: "", title: "", caption: "", offer: "", faqs: [{ q: "", a: "" }], active: true })

function KnowledgeStep({ status, reload }: { status: Status; reload: () => void }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [media, setMedia] = useState<any[] | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMedia = async () => {
    const r = await apiJson<any>("/api/instagram/media")
    if (r.ok) setMedia((r.data.data || []).filter((m: any) => m.media_type === "VIDEO" || m.media_product_type === "REELS"))
    else setMediaError(r.error || "Could not load your Reels. You can paste a media id instead.")
  }
  useEffect(() => { loadMedia() }, [])

  const pick = (m: any) => {
    const caption = String(m.caption || "")
    setDraft((d) => ({ ...d, mediaId: m.id, caption, title: d.title || caption.split("\n")[0].slice(0, 60) }))
  }
  const save = async () => {
    setBusy(true); setError(null)
    const r = await apiJson("/api/ai-agent/knowledge", { method: "PUT", body: JSON.stringify({ ...draft, faqs: draft.faqs.filter((f) => f.q.trim() && f.a.trim()) }) })
    setBusy(false)
    if (!r.ok) return setError(r.error || "Could not save")
    toast.success("Reel knowledge saved")
    setDraft(emptyDraft()); reload()
  }
  const remove = async (mediaId: string) => {
    await apiJson(`/api/ai-agent/knowledge?mediaId=${encodeURIComponent(mediaId)}`, { method: "DELETE" })
    reload()
  }
  const setFaq = (i: number, patch: Partial<Faq>) => setDraft((d) => ({ ...d, faqs: d.faqs.map((f, j) => (j === i ? { ...f, ...patch } : f)) }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">The agent answers only from what you write here. If something is not covered it tells the person a human will follow up.</p>
      {status.knowledge.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {status.knowledge.map((k: any) => (
            <li key={k.mediaId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <button type="button" className="min-w-0 flex-1 truncate text-left font-medium text-foreground cursor-pointer" onClick={() => setDraft({ mediaId: k.mediaId, title: k.title, caption: k.caption, offer: k.offer, faqs: k.faqs.length ? k.faqs : [{ q: "", a: "" }], active: k.active })}>
                {k.title || k.mediaId}{!k.active && <span className="ml-2 text-xs text-muted-foreground">(off)</span>}
              </button>
              <button type="button" aria-label="Delete" className="text-muted-foreground hover:text-destructive cursor-pointer" onClick={() => remove(k.mediaId)}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Pick a Reel</p>
        {media === null && !mediaError && <p className="text-xs text-muted-foreground">Loading your Reels...</p>}
        {mediaError && <p className="text-xs text-muted-foreground">{mediaError}</p>}
        {media && media.length === 0 && <p className="text-xs text-muted-foreground">No recent Reels found. Paste a media id below.</p>}
        {media && media.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {media.slice(0, 12).map((m) => (
              <button key={m.id} type="button" onClick={() => pick(m)} className={cn("h-24 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-secondary cursor-pointer", draft.mediaId === m.id ? "border-brand" : "border-transparent")} aria-label={`Pick Reel ${String(m.caption || m.id).slice(0, 30)}`}>
                {(m.thumbnail_url || m.media_url) && <img src={m.thumbnail_url || m.media_url} alt="" className="h-full w-full object-cover" />}
              </button>
            ))}
          </div>
        )}
        <label className="mt-2 block text-xs text-muted-foreground">Or paste the media id
          <input className={`${field} mt-1`} value={draft.mediaId} onChange={(e) => setDraft({ ...draft, mediaId: e.target.value.trim() })} placeholder="17900000000000000" inputMode="numeric" />
        </label>
      </div>

      <label className="block text-sm font-medium text-foreground">Title (what you call this offer)
        <input className={`${field} mt-1`} value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Hair care brochure" />
      </label>
      <label className="block text-sm font-medium text-foreground">Caption (filled from Instagram, edit if needed)
        <textarea className={`${field} mt-1 min-h-24`} value={draft.caption} maxLength={2200} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} />
      </label>
      <label className="block text-sm font-medium text-foreground">Offer and key details
        <textarea className={`${field} mt-1 min-h-20`} value={draft.offer} maxLength={1000} onChange={(e) => setDraft({ ...draft, offer: e.target.value })} placeholder="What is included, price if you want it shared, dates, how to book." />
      </label>
      <div>
        <p className="mb-1 text-sm font-medium text-foreground">FAQs</p>
        <div className="space-y-2">
          {draft.faqs.map((f, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-border p-2 sm:grid-cols-2">
              <input className={field} value={f.q} maxLength={300} onChange={(e) => setFaq(i, { q: e.target.value })} placeholder="Question" />
              <div className="flex gap-2">
                <input className={field} value={f.a} maxLength={800} onChange={(e) => setFaq(i, { a: e.target.value })} placeholder="Answer" />
                <button type="button" aria-label="Remove FAQ" className="text-muted-foreground hover:text-destructive cursor-pointer" onClick={() => setDraft((d) => ({ ...d, faqs: d.faqs.filter((_, j) => j !== i) }))}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
        {draft.faqs.length < 20 && <button type="button" className={`${ghostBtn} mt-2`} onClick={() => setDraft((d) => ({ ...d, faqs: [...d.faqs, { q: "", a: "" }] }))}><Plus className="h-4 w-4" />Add FAQ</button>}
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground"><Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} /> Active</label>
      <ErrorNote message={error} />
      <button className={primaryBtn} onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save Reel knowledge</button>
    </div>
  )
}

// ---------- Step 3 ----------
function BehaviorStep({ status, reload }: { status: Status; reload: () => void }) {
  const s = status.settings
  const [tone, setTone] = useState(s.tone)
  const [language, setLanguage] = useState(s.language)
  const [handoff, setHandoff] = useState(s.handoffRules)
  const [scores, setScores] = useState(s.scores)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async () => {
    setBusy(true); setError(null)
    const r = await apiJson("/api/ai-agent/settings", { method: "PUT", body: JSON.stringify({ tone, language, handoffRules: handoff, scores, settingsSaved: true }) })
    setBusy(false)
    if (!r.ok) return setError(r.error || "Could not save")
    toast.success("Saved"); reload()
  }
  const num = (k: string) => (
    <label className="block text-xs text-muted-foreground">{k === "wa_lead" ? "WhatsApp lead" : k === "email_lead" ? "Email lead" : "Engaged"}
      <input className={`${field} mt-1`} type="number" min={0} max={100} value={scores[k]} onChange={(e) => setScores({ ...scores, [k]: Number(e.target.value) })} />
    </label>
  )
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-foreground">Tone
          <select className={`${field} mt-1`} value={tone} onChange={(e) => setTone(e.target.value)}>
            <option value="friendly">Friendly</option><option value="professional">Professional</option><option value="casual">Casual</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-foreground">Language
          <select className={`${field} mt-1`} value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="auto">Match the person (English, Hindi, Hinglish)</option><option value="english">English</option><option value="hindi">Hindi</option><option value="hinglish">Hinglish</option>
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium text-foreground">Hand over to a human when
        <textarea className={`${field} mt-1 min-h-20`} value={handoff} maxLength={600} onChange={(e) => setHandoff(e.target.value)} placeholder="The person asks about refunds, complaints, medical questions, or wants a call." />
      </label>
      <p className="text-xs text-muted-foreground">The agent also hands over by itself when it cannot answer from your details, after 12 replies, or if someone keeps trying to change its instructions.</p>

      <div className="rounded-xl bg-[#FFF6F1] p-3 text-sm text-foreground dark:bg-secondary">
        <p className="font-semibold">Consent line (fixed wording, sent by Celra before any number is accepted)</p>
        <p className="mt-1 italic">{status.consentLine}</p>
        <p className="mt-2 font-semibold">If they say no, it offers email once</p>
        <p className="mt-1 italic">{status.emailOfferLine}</p>
        <p className="mt-2 text-xs text-muted-foreground">A number given without a yes is kept as unverified and is not sent to AiSend.</p>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-foreground">Lead scores (0 to 100)</p>
        <div className="grid grid-cols-3 gap-3">{["wa_lead", "email_lead", "engaged"].map(num)}</div>
      </div>
      <ErrorNote message={error} />
      <button className={primaryBtn} onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button>
    </div>
  )
}

// ---------- Step 4 ----------
function ActivateStep({ status, reload }: { status: Status; reload: () => void }) {
  const active = status.knowledge.filter((k: any) => k.active)
  const [mediaId, setMediaId] = useState(active[0]?.mediaId || "")
  const [keyword, setKeyword] = useState("brochure")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const on = async () => {
    setBusy(true); setError(null)
    const r = await apiJson("/api/ai-agent/activate", { method: "POST", body: JSON.stringify({ mediaId, keyword }) })
    setBusy(false)
    if (!r.ok) return setError(r.error || "Could not turn on")
    toast.success("AI Sales Agent is on"); reload()
  }
  const off = async () => { await apiJson("/api/ai-agent/activate", { method: "DELETE" }); toast.success("Agent paused"); reload() }
  return (
    <div className="space-y-3">
      {!status.modelConfigured && <p className="rounded-lg bg-[#FFF6F1] px-3 py-2 text-sm text-foreground">The AI model is not configured on this server yet, so the agent cannot reply. Ask the Celra admin to add the model key.</p>}
      <p className="text-sm text-muted-foreground">Celra creates the comment automation for you. When someone comments the word on this Reel they get one private reply, and the agent continues the chat if they reply.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-foreground">Reel
          <select className={`${field} mt-1`} value={mediaId} onChange={(e) => setMediaId(e.target.value)}>
            {active.length === 0 && <option value="">Add Reel knowledge first</option>}
            {active.map((k: any) => <option key={k.mediaId} value={k.mediaId}>{k.title || k.mediaId}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-foreground">Comment word
          <input className={`${field} mt-1`} value={keyword} maxLength={80} onChange={(e) => setKeyword(e.target.value)} placeholder="brochure" />
        </label>
      </div>
      <ErrorNote message={error} />
      <div className="flex flex-wrap gap-2">
        <button className={primaryBtn} onClick={on} disabled={busy || !mediaId}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{status.settings.enabled ? "Update and keep on" : "Turn on"}</button>
        {status.settings.enabled && <button className={ghostBtn} onClick={off}>Pause the agent</button>}
      </div>
      {status.rules.length > 0 && (
        <ul className="text-sm text-muted-foreground">
          {status.rules.map((r: any) => <li key={r.id}>{r.name}: comment <strong className="text-foreground">{r.keyword}</strong> ({r.active ? "on" : "paused"})</li>)}
        </ul>
      )}
    </div>
  )
}

export function SetupWizard() {
  const { data, error, loading, reload } = useApi<Status>("/api/ai-agent/status")
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => { if (data && open === null) setOpen(data.wizard.nextStep ?? 1) }, [data, open])
  if (loading && !data) return <p className="text-sm text-muted-foreground">Loading...</p>
  if (error || !data) return <ErrorNote message={error || "Could not load"} />
  const steps = data.wizard.steps as { id: number; title: string; done: boolean; optional: boolean }[]
  const body: Record<number, React.ReactNode> = {
    1: <ConnectorStep status={data} reload={reload} />, 2: <KnowledgeStep status={data} reload={reload} />, 3: <BehaviorStep status={data} reload={reload} />, 4: <ActivateStep status={data} reload={reload} />,
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{data.wizard.doneCount} of 4 steps done.</p>
      {steps.map((s) => (
        <StepShell key={s.id} n={s.id} title={s.title} done={s.done} optional={s.optional} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)}>
          {body[s.id]}
        </StepShell>
      ))}
    </div>
  )
}
