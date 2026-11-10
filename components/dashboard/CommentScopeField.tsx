"use client"

import { Check, Globe, Film, Sparkles } from "lucide-react"
import type { CommentScope } from "@/lib/automations/comment-scope"

/**
 * Picker for which posts a comment rule listens to: one post/reel, all posts, or the next post.
 *
 * Who uses it: components/dashboard/CreateRuleForm.tsx (step 1, comment rules). The post chooser itself stays in the
 * form and is shown only for "specific".
 * Why it exists: "next post" lets a creator set the rule up before publishing; the rule binds to the first new post
 * that gets a matching comment (how that works: lib/automations/comment-scope.ts).
 */
const OPTIONS: { key: CommentScope; icon: typeof Globe; label: string; hint: string }[] = [
  { key: "specific", icon: Film, label: "One post or reel", hint: "Only comments on the post you pick" },
  { key: "all", icon: Globe, label: "All posts and reels", hint: "Any post, when the keyword is used" },
  { key: "next", icon: Sparkles, label: "My next post", hint: "Binds to the first post you publish from now on" },
]

export function CommentScopeField({
  value,
  onChange,
  disabled,
  disabledKeys = [],
}: {
  value: CommentScope
  onChange: (v: CommentScope) => void
  /** Whole control locked (audit suggestions must stay on one post). */
  disabled?: boolean
  /** Options that make no sense right now, for example "all posts" together with "reply to every comment". */
  disabledKeys?: CommentScope[]
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider ml-1">Which posts?</p>
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Which posts should this apply to">
        {OPTIONS.map(({ key, icon: Icon, label, hint }) => {
          const off = disabled || disabledKeys.includes(key)
          const on = value === key
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={off}
              onClick={() => onChange(key)}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-brand ${
                on ? "border-brand/50 bg-brand-soft" : "border-border hover:border-muted-foreground/30 hover:bg-secondary"
              }`}
            >
              <span className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${on ? "text-brand" : "text-muted-foreground"}`} />
                <span className={`text-sm font-bold ${on ? "text-brand" : "text-foreground"}`}>{label}</span>
                {on && <Check className="w-3.5 h-3.5 text-brand ml-auto" />}
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug">{hint}</span>
            </button>
          )
        })}
      </div>
      {value === "next" && (
        <p className="text-[11px] text-muted-foreground leading-relaxed ml-1">
          Instagram does not tell us when you publish. The rule waits, and when someone uses your keyword on a post made after today it
          attaches itself to that post. Comments on older posts never trigger it. It shows under &quot;Waiting for your next post&quot; until then.
        </p>
      )}
    </div>
  )
}
