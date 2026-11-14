"use client"

/**
 * "Test the agent": a rehearsal chat with a fake sender. POSTs to /api/ai-agent/test, which runs the real engine on your
 * knowledge but sends nothing to Instagram, stores no contact and dispatches no lead. Conversation state stays in this page.
 */
import { useState } from "react"
import { Loader2, Send } from "lucide-react"
import { ErrorNote, HEADING, apiJson, card, field, ghostBtn, primaryBtn, useApi } from "./shared"

interface Line { role: "user" | "assistant"; text: string }

export function TestPanel() {
  const status = useApi<any>("/api/ai-agent/status")
  const [mediaId, setMediaId] = useState("")
  const [lines, setLines] = useState<Line[]>([])
  const [state, setState] = useState<any>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const knowledge: any[] = (status.data?.knowledge || []).filter((k: any) => k.active)
  const selected = mediaId || knowledge[0]?.mediaId || ""

  const send = async () => {
    const message = text.trim()
    if (!message || busy) return
    setBusy(true); setError(null); setText("")
    const history = lines
    setLines([...history, { role: "user", text: message }])
    const r = await apiJson<any>("/api/ai-agent/test", { method: "POST", body: JSON.stringify({ mediaId: selected, message, state, history }) })
    setBusy(false)
    if (!r.ok) return setError(r.error || "The test failed")
    setState(r.data.state)
    if (r.data.reply) setLines((l) => [...l, { role: "assistant", text: r.data.reply }])
    const n = [...(r.data.wouldDo || []).map((w: any) => w.note), ...(r.data.injectionSuspected ? ["That message looked like an attempt to change the agent's instructions."] : [])]
    if (n.length) setNotes((prev) => [...prev, ...n])
  }
  const reset = () => { setLines([]); setState(null); setNotes([]); setError(null) }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_280px]">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={`${HEADING} text-base font-semibold text-foreground`}>Rehearsal chat</h2>
          <button className={ghostBtn} onClick={reset}>Start over</button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">A fake sender. Nothing is sent on Instagram and no lead is sent to AiSend.</p>
        {knowledge.length > 0 && (
          <label className="mt-3 block text-sm font-medium text-foreground">Reel knowledge
            <select className={`${field} mt-1`} value={selected} onChange={(e) => { setMediaId(e.target.value); reset() }}>
              {knowledge.map((k) => <option key={k.mediaId} value={k.mediaId}>{k.title || k.mediaId}</option>)}
            </select>
          </label>
        )}
        {knowledge.length === 0 && !status.loading && <p className="mt-3 text-sm text-muted-foreground">Add Reel knowledge in Setup (or business context in Settings) to test.</p>}
        <ul className="mt-4 min-h-40 space-y-2">
          {lines.length === 0 && <li className="text-sm text-muted-foreground">Type what a follower might say, for example &quot;What is included?&quot;</li>}
          {lines.map((l, i) => (
            <li key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${l.role === "user" ? "ml-auto bg-secondary text-foreground" : "bg-brand text-brand-foreground"}`}>{l.text}</li>
          ))}
          {busy && <li className="text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> Thinking...</li>}
        </ul>
        <ErrorNote message={error} />
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send() }}>
          <input className={field} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type as the follower" maxLength={1000} aria-label="Message" />
          <button className={primaryBtn} type="submit" disabled={busy || !text.trim()} aria-label="Send"><Send className="h-4 w-4" /></button>
        </form>
      </div>
      <aside className={card}>
        <h3 className={`${HEADING} text-sm font-semibold text-foreground`}>What would happen</h3>
        {notes.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Saves, handoffs and lead sends show up here. Try giving a phone number after saying yes.</p> : (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        )}
        {state && <p className="mt-3 text-xs text-muted-foreground">Consent: <strong className="text-foreground">{state.consent.status}</strong> · Replies: {state.turn}/12</p>}
      </aside>
    </div>
  )
}
