"use client"

import { useMemo, useState } from "react"
import { simulate, type FlowGraph, type SimOptions } from "@/lib/flows/engine"
import { DEFAULT_TIMEZONE, dateAtLocalTime, normalizeVarName } from "@/lib/flows/conditions"
import { PhoneChat } from "@/components/flows/phone-chat"
import { FlaskConical, RotateCcw, Send } from "lucide-react"

/** Parses "key=value" lines into a variable map (names are normalised like the real ones). */
function parseVariables(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split("\n")) {
    const i = line.indexOf("=")
    if (i < 1) continue
    const k = normalizeVarName(line.slice(0, i))
    if (k) out[k] = line.slice(i + 1).trim()
  }
  return out
}

/**
 * Dry-run phone preview: plays the flow with the same engine production uses, in an
 * Instagram-DM look. Sends no DMs and adds no tags. graph=null when the canvas has no valid flow.
 */
export function FlowTester({ graph, account = "your_brand" }: { graph: FlowGraph | null; account?: string }) {
  const [replies, setReplies] = useState<string[]>([])
  const [draft, setDraft] = useState("")
  // "Test as" data: what the pretend person already has, so tag / saved-value / follow / time conditions can be tried.
  const [testTags, setTestTags] = useState("")
  const [testVars, setTestVars] = useState("")
  const [testFollows, setTestFollows] = useState<"unknown" | "following" | "not_following">("unknown")
  const [testTime, setTestTime] = useState("")
  const [testInWindow, setTestInWindow] = useState(true)

  const result = useMemo(() => {
    if (!graph) return null
    const opts: SimOptions = {
      tags: testTags.split(",").map((t) => t.trim()).filter(Boolean),
      variables: parseVariables(testVars),
      follows: testFollows,
      inWindow: testInWindow,
    }
    if (testTime) {
      const when = dateAtLocalTime(testTime, graph.timezone || DEFAULT_TIMEZONE)
      if (when) opts.now = when
    }
    return simulate(graph, replies, opts)
  }, [graph, replies, testTags, testVars, testFollows, testTime, testInWindow])

  // Tappable suggestions: the quick reply chips on the last message plus the keywords the next condition waits for.
  const chips = result ? Array.from(new Set([...result.quickReplies, ...result.waitingFor])) : []

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

      <details className="rounded-xl border border-border bg-background/60 px-3 py-2 text-xs">
        <summary className="cursor-pointer font-bold text-foreground">Test as a person who... (optional)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Has these tags</span>
            <input value={testTags} onChange={(e) => setTestTags(e.target.value)} placeholder="vip, warm-lead" className="w-full h-8 px-2 rounded-lg border border-border bg-background text-[11px] outline-none focus:border-primary/60" />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Follows my account</span>
            <select value={testFollows} onChange={(e) => setTestFollows(e.target.value as typeof testFollows)} className="w-full h-8 px-2 rounded-lg border border-border bg-background text-[11px] outline-none focus:border-primary/60">
              <option value="unknown">Instagram cannot tell</option>
              <option value="following">Yes</option>
              <option value="not_following">No</option>
            </select>
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saved values (one per line, name=value)</span>
            <textarea value={testVars} onChange={(e) => setTestVars(e.target.value)} rows={2} placeholder={"budget=7500\ncity=Pune"} className="w-full p-2 rounded-lg border border-border bg-background text-[11px] font-mono outline-none focus:border-primary/60 resize-none" />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pretend the time is ({graph?.timezone || DEFAULT_TIMEZONE})</span>
            <input type="time" value={testTime} onChange={(e) => setTestTime(e.target.value)} className="w-full h-8 px-2 rounded-lg border border-border bg-background text-[11px] outline-none focus:border-primary/60" />
          </label>
          <label className="flex items-center gap-2 pt-5">
            <input type="checkbox" checked={testInWindow} onChange={(e) => setTestInWindow(e.target.checked)} className="h-4 w-4 accent-primary" />
            <span className="text-[11px] font-semibold text-foreground">Inside the 24 hour window</span>
          </label>
        </div>
      </details>

      {!result ? (
        <p className="text-sm text-muted-foreground">Connect the trigger to at least one message to test.</p>
      ) : (
        <>
          <PhoneChat
            account={account}
            lines={result.finished ? [...result.lines, { from: "system", text: "Flow finished" }] : result.lines}
            footer={
              <div style={{ display: "grid", gap: 8 }}>
                {!result.finished && chips.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {chips.map((k) => (
                      <button
                        key={k}
                        onClick={() => send(k)}
                        style={{ border: "1px solid var(--border)", borderRadius: 16, padding: "4px 11px", fontSize: 12, fontWeight: 600, color: "var(--brand)", background: "var(--card)" }}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--border)", borderRadius: 22, padding: "4px 6px 4px 14px" }}>
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
                    style={{ border: 0, background: "transparent", color: "var(--brand)", opacity: result.finished || !draft.trim() ? 0.35 : 1, display: "grid", placeItems: "center", padding: 6 }}
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
          {result.removedTags.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Tags this path removes: {result.removedTags.map((t) => `#${t}`).join(", ")}
            </p>
          )}
          {Object.keys(result.variables).length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Values this path saves: {Object.entries(result.variables).map(([k, v]) => `${k} = ${v}`).join(", ")}
            </p>
          )}
        </>
      )}
    </div>
  )
}
