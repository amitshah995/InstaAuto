"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { simulate, type FlowGraph } from "@/lib/flows/engine"
import { FlaskConical, RotateCcw, Send } from "lucide-react"

/**
 * Dry-run panel: plays the flow with the same engine production uses, sends no DMs,
 * adds no tags. Pass graph=null when the canvas has no valid flow yet.
 */
export function FlowTester({ graph }: { graph: FlowGraph | null }) {
  const [replies, setReplies] = useState<string[]>([])
  const [draft, setDraft] = useState("")

  const result = useMemo(() => (graph ? simulate(graph, replies) : null), [graph, replies])

  const send = () => {
    const t = draft.trim()
    if (!t || result?.finished) return
    setReplies((r) => [...r, t])
    setDraft("")
  }

  return (
    <div className="rounded-2xl border border-border bg-card/80 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-primary" /> Test this flow
        </h3>
        <Button size="sm" variant="ghost" onClick={() => setReplies([])} disabled={replies.length === 0} className="gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Restart
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Nothing is sent to Instagram and no contact is tagged. Type a reply the way a follower would.
      </p>

      {!result ? (
        <p className="text-sm text-muted-foreground">Connect the trigger to at least one message to test.</p>
      ) : (
        <>
          <div className="space-y-2 max-h-72 overflow-y-auto rounded-xl bg-secondary/20 p-3">
            {result.lines.map((l, i) =>
              l.from === "system" ? (
                <p key={i} className="text-center text-[11px] font-semibold text-muted-foreground">{l.text}</p>
              ) : (
                <div key={i} className={`flex ${l.from === "user" ? "justify-end" : "justify-start"}`}>
                  <span
                    className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                      l.from === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                    }`}
                  >
                    {l.text}
                  </span>
                </div>
              ),
            )}
            {result.finished && <p className="text-center text-[11px] font-bold text-emerald-600">Flow finished</p>}
          </div>
          {result.tags.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Tags this path adds: {result.tags.map((t) => `#${t}`).join(", ")}
            </p>
          )}
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={result.finished ? "Flow finished — press Restart" : "Type a follower reply…"}
              disabled={result.finished}
              className="rounded-xl"
            />
            <Button onClick={send} disabled={result.finished || !draft.trim()} className="rounded-xl gap-1.5">
              <Send className="w-4 h-4" /> Send
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
