"use client"

import { useMemo, useState } from "react"
import { simulate, type FlowGraph } from "@/lib/flows/engine"
import { PhoneChat } from "@/components/flows/phone-chat"
import { FlaskConical, RotateCcw, Send } from "lucide-react"

/**
 * Dry-run phone preview: plays the flow with the same engine production uses, in an
 * Instagram-DM look. Sends no DMs and adds no tags. graph=null when the canvas has no valid flow.
 */
export function FlowTester({ graph, account = "your_brand" }: { graph: FlowGraph | null; account?: string }) {
  const [replies, setReplies] = useState<string[]>([])
  const [draft, setDraft] = useState("")

  const result = useMemo(() => (graph ? simulate(graph, replies) : null), [graph, replies])

  const send = (text?: string) => {
    const t = (text ?? draft).trim()
    if (!t || result?.finished) return
    setReplies((r) => [...r, t])
    setDraft("")
  }

  return (
    <div className="rounded-2xl border border-border bg-card/80 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-primary" /> Test this flow
        </h3>
        <button
          onClick={() => setReplies([])}
          disabled={replies.length === 0}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground disabled:opacity-40"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Restart
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Preview of how a follower sees this chat. Nothing is sent to Instagram and no contact is tagged.
      </p>

      {!result ? (
        <p className="text-sm text-muted-foreground">Connect the trigger to at least one message to test.</p>
      ) : (
        <>
          <PhoneChat
            account={account}
            lines={result.finished ? [...result.lines, { from: "system", text: "Flow finished" }] : result.lines}
            footer={
              <div style={{ display: "grid", gap: 8 }}>
                {!result.finished && result.waitingFor.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.waitingFor.map((k) => (
                      <button
                        key={k}
                        onClick={() => send(k)}
                        style={{ border: "1px solid #dbdbdb", borderRadius: 16, padding: "4px 11px", fontSize: 12, fontWeight: 600, color: "#3d7bf7", background: "#fff" }}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #dbdbdb", borderRadius: 22, padding: "4px 6px 4px 14px" }}>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    disabled={result.finished}
                    placeholder={result.finished ? "Press Restart" : "Message..."}
                    style={{ flex: 1, border: 0, outline: 0, fontSize: 13, background: "transparent", color: "#111", minWidth: 0 }}
                  />
                  <button
                    onClick={() => send()}
                    disabled={result.finished || !draft.trim()}
                    aria-label="Send"
                    style={{ border: 0, background: "transparent", color: "#3d7bf7", opacity: result.finished || !draft.trim() ? 0.35 : 1, display: "grid", placeItems: "center", padding: 6 }}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            }
          />
          {result.tags.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Tags this path adds: {result.tags.map((t) => `#${t}`).join(", ")}
            </p>
          )}
        </>
      )}
    </div>
  )
}
