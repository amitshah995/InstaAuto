"use client"

/**
 * Conversations tab: read the agent's chats and press "Take over" (sets human_handled so the bot goes silent).
 * Data: GET /api/ai-agent/conversations (list, then ?igsid= for messages), POST to take over.
 */
import { useState } from "react"
import { toast } from "sonner"
import { ErrorNote, HEADING, StatusPill, apiJson, card, ghostBtn, primaryBtn, useApi } from "./shared"

export function ConversationsPanel() {
  const { data, error, loading, reload } = useApi<any>("/api/ai-agent/conversations")
  const [open, setOpen] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<any[] | null>(null)
  const [busy, setBusy] = useState(false)

  const view = async (igsid: string) => {
    setOpen(igsid); setMsgs(null)
    const r = await apiJson<any>(`/api/ai-agent/conversations?igsid=${encodeURIComponent(igsid)}`)
    if (r.ok) setMsgs(r.data.messages || [])
    else { setMsgs([]); toast.error(r.error || "Could not load the messages") }
  }
  const takeOver = async (igsid: string) => {
    setBusy(true)
    const r = await apiJson("/api/ai-agent/conversations", { method: "POST", body: JSON.stringify({ igsid }) })
    setBusy(false)
    if (!r.ok) return toast.error(r.error)
    toast.success("You have taken over. The agent will stay silent in this chat.")
    reload()
  }

  if (loading && !data) return <p className="text-sm text-muted-foreground">Loading...</p>
  if (error || !data) return <ErrorNote message={error || "Could not load"} />
  const list = data.conversations as any[]
  if (list.length === 0) return <div className={card}><p className="text-sm text-muted-foreground">No agent conversations yet. They appear when someone comments your keyword on a Reel and replies to the first message.</p></div>
  const current = list.find((c) => c.igsid === open)

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <ul className={`${card} max-h-[70vh] divide-y divide-border overflow-y-auto p-0 sm:p-0`}>
        {list.map((c) => (
          <li key={c.igsid}>
            <button type="button" onClick={() => view(c.igsid)} className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm cursor-pointer hover:bg-secondary ${open === c.igsid ? "bg-accent" : ""}`}>
              <span className="min-w-0"><span className="block truncate font-medium text-foreground">{c.username ? `@${c.username}` : "Contact"}</span><span className="text-xs text-muted-foreground">{c.turns} replies · {new Date(c.updatedAt).toLocaleDateString("en-IN")}</span></span>
              <StatusPill status={c.humanHandled ? "handoff" : c.status} />
            </button>
          </li>
        ))}
      </ul>
      <div className={card}>
        {!current ? <p className="text-sm text-muted-foreground">Choose a conversation to read it.</p> : (
          <>
            <div className="flex items-center justify-between gap-2">
              <h2 className={`${HEADING} text-base font-semibold text-foreground`}>{current.username ? `@${current.username}` : "Contact"}</h2>
              {current.humanHandled || current.status === "handoff" ? <span className="text-xs text-muted-foreground">A human is handling this chat</span> : <button className={primaryBtn} disabled={busy} onClick={() => takeOver(current.igsid)}>Take over</button>}
            </div>
            <ul className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto">
              {msgs === null && <li className="text-sm text-muted-foreground">Loading messages...</li>}
              {msgs?.length === 0 && <li className="text-sm text-muted-foreground">No messages stored for this chat.</li>}
              {(msgs ?? []).map((m, i) => (
                <li key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.fromPerson ? "bg-secondary text-foreground" : "ml-auto bg-brand text-brand-foreground"}`}>{m.text}</li>
              ))}
            </ul>
            <button className={`${ghostBtn} mt-3`} onClick={() => view(current.igsid)}>Refresh</button>
          </>
        )}
      </div>
    </div>
  )
}
