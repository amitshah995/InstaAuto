"use client"

import { Plus, Trash2 } from "lucide-react"
import { MAX_RULES_PER_CONDITION, type CondRule } from "@/lib/flows/conditions"

/**
 * Editor for the rules of ONE condition branch: up to 5 rules joined by AND or OR.
 *
 * Who uses it: app/dashboard/flow-builder/page.tsx (properties panel of a condition node, one editor per branch).
 * Why it exists: conditions used to be a single keyword. A branch can now test saved variables, contact tags, whether the
 * person follows the account, the 24 hour window, the time of day, the message text and the tapped quick reply. The data
 * shape is documented in lib/flows/conditions.ts; this component only edits it.
 */
export interface QuickReplyChoice {
  title: string
  payload: string
}


const KIND_LABEL: Record<CondRule["kind"], string> = {
  variable: "Saved value",
  tag: "Contact tag",
  follows: "Follows my account",
  in_window: "Inside 24h window",
  time: "Time of day",
  text: "Message text",
  quick_reply: "Tapped quick reply",
}

const field = "h-8 px-2 rounded-lg border border-border bg-background text-[11px] outline-none focus:border-primary/60 min-w-0"

function blankRule(kind: CondRule["kind"], chips: QuickReplyChoice[]): CondRule {
  switch (kind) {
    case "variable": return { kind: "variable", name: "", op: "equals", value: "" }
    case "tag": return { kind: "tag", tag: "", op: "has" }
    case "follows": return { kind: "follows", op: "is" }
    case "in_window": return { kind: "in_window", op: "is" }
    case "time": return { kind: "time", from: "09:00", to: "18:00", op: "between" }
    case "text": return { kind: "text", op: "contains", value: "" }
    case "quick_reply": return { kind: "quick_reply", payload: chips[0]?.payload ?? "" }
  }
}

export function ConditionRulesEditor({
  rules,
  match,
  onChange,
  chips,
}: {
  rules: CondRule[]
  match: "all" | "any"
  onChange: (next: { rules: CondRule[]; match: "all" | "any" }) => void
  /** Quick reply chips defined on the flow's message nodes, offered for the "tapped quick reply" rule. */
  chips: QuickReplyChoice[]
}) {
  const set = (i: number, r: CondRule) => onChange({ match, rules: rules.map((x, j) => (j === i ? r : x)) })
  const remove = (i: number) => onChange({ match, rules: rules.filter((_, j) => j !== i) })
  const add = () => rules.length < MAX_RULES_PER_CONDITION && onChange({ match, rules: [...rules, blankRule("text", chips)] })

  return (
    <div className="space-y-1.5">
      {rules.map((r, i) => (
        <div key={i} className="rounded-lg border border-border bg-background/70 p-1.5 space-y-1.5">
          <div className="flex items-center gap-1.5">
            {i > 0 && <span className="text-[9px] font-black uppercase tracking-wider text-brand w-7 shrink-0">{match === "any" ? "or" : "and"}</span>}
            <select
              value={r.kind}
              onChange={(e) => set(i, blankRule(e.target.value as CondRule["kind"], chips))}
              className={`${field} flex-1`}
              aria-label="What to check"
            >
              {(Object.keys(KIND_LABEL) as CondRule["kind"][]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
            <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="Remove rule">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {r.kind === "variable" && (
            <div className="flex flex-wrap gap-1.5">
              <input value={r.name} onChange={(e) => set(i, { ...r, name: e.target.value })} placeholder="name, email, budget..." className={`${field} flex-1 basis-24 font-mono`} aria-label="Saved value name" />
              <select value={r.op} onChange={(e) => set(i, { ...r, op: e.target.value as typeof r.op })} className={field} aria-label="Comparison">
                <option value="equals">is</option>
                <option value="not_equals">is not</option>
                <option value="contains">contains</option>
                <option value="gt">is more than</option>
                <option value="lt">is less than</option>
                <option value="is_set">is filled in</option>
                <option value="not_set">is empty</option>
              </select>
              {r.op !== "is_set" && r.op !== "not_set" && (
                <input value={r.value ?? ""} onChange={(e) => set(i, { ...r, value: e.target.value })} placeholder="value" className={`${field} flex-1 basis-20`} aria-label="Value" />
              )}
            </div>
          )}

          {r.kind === "tag" && (
            <div className="flex gap-1.5">
              <select value={r.op} onChange={(e) => set(i, { ...r, op: e.target.value as typeof r.op })} className={field} aria-label="Has or does not have">
                <option value="has">has tag</option>
                <option value="not_has">does not have tag</option>
              </select>
              <input value={r.tag} onChange={(e) => set(i, { ...r, tag: e.target.value })} placeholder="e.g. warm-lead" className={`${field} flex-1`} aria-label="Tag" />
            </div>
          )}

          {(r.kind === "follows" || r.kind === "in_window") && (
            <div className="space-y-1">
              <select value={r.op} onChange={(e) => set(i, { ...r, op: e.target.value as typeof r.op })} className={`${field} w-full`} aria-label="Yes or no">
                <option value="is">{r.kind === "follows" ? "follows my account" : "is inside the 24 hour window"}</option>
                <option value="is_not">{r.kind === "follows" ? "does not follow my account" : "is outside the 24 hour window"}</option>
              </select>
              {r.kind === "follows" && (
                <p className="text-[9px] text-muted-foreground leading-snug">
                  Checked with Instagram when the person has allowed it. If Instagram cannot tell, neither &quot;follows&quot; nor &quot;does not follow&quot; matches and the flow takes the else path.
                </p>
              )}
            </div>
          )}

          {r.kind === "time" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <select value={r.op} onChange={(e) => set(i, { ...r, op: e.target.value as typeof r.op })} className={field} aria-label="Inside or outside">
                <option value="between">between</option>
                <option value="not_between">not between</option>
              </select>
              <input type="time" value={r.from} onChange={(e) => set(i, { ...r, from: e.target.value })} className={field} aria-label="From time" />
              <span className="text-[10px] text-muted-foreground">and</span>
              <input type="time" value={r.to} onChange={(e) => set(i, { ...r, to: e.target.value })} className={field} aria-label="To time" />
            </div>
          )}

          {r.kind === "text" && (
            <div className="flex flex-wrap gap-1.5">
              <select value={r.op} onChange={(e) => set(i, { ...r, op: e.target.value as typeof r.op })} className={field} aria-label="Text comparison">
                <option value="contains">contains</option>
                <option value="not_contains">does not contain</option>
                <option value="equals">is exactly</option>
                <option value="keyword">has the word(s)</option>
              </select>
              <input value={r.value} onChange={(e) => set(i, { ...r, value: e.target.value })} placeholder={r.op === "keyword" ? "price, cost" : "text"} className={`${field} flex-1 basis-24`} aria-label="Text" />
            </div>
          )}

          {r.kind === "quick_reply" && (
            chips.length > 0 ? (
              <select value={r.payload} onChange={(e) => set(i, { ...r, payload: e.target.value })} className={`${field} w-full`} aria-label="Quick reply">
                {!chips.some((c) => c.payload === r.payload) && r.payload && <option value={r.payload}>{r.payload}</option>}
                {chips.map((c) => (
                  <option key={c.payload} value={c.payload}>{c.title}</option>
                ))}
              </select>
            ) : (
              <p className="text-[10px] text-muted-foreground">Add quick replies to a message node first, then pick one here.</p>
            )
          )}
        </div>
      ))}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={add}
          disabled={rules.length >= MAX_RULES_PER_CONDITION}
          className="inline-flex items-center gap-1 text-[10px] font-bold text-brand disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-brand"
        >
          <Plus className="w-3 h-3" /> Add rule ({rules.length}/{MAX_RULES_PER_CONDITION})
        </button>
        {rules.length > 1 && (
          <div className="inline-flex rounded-lg border border-border overflow-hidden" role="group" aria-label="Combine rules">
            {(["all", "any"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ rules, match: m })}
                aria-pressed={match === m}
                className={`px-2 h-6 text-[10px] font-bold ${match === m ? "bg-brand text-brand-foreground" : "bg-background text-muted-foreground hover:bg-secondary"}`}
              >
                {m === "all" ? "All (AND)" : "Any (OR)"}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
