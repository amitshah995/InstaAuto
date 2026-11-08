import { Cake, CheckCheck, Heart, MessageCircle, Send, ShoppingBag, Tag, UserPlus, Lock, Workflow, CircleDot } from "lucide-react"
import { BRAND_NAME } from "@/lib/site"
import { SampleTag } from "../ui"

/** Pure HTML/CSS drawings. All names, numbers and messages are samples. */

const card = "rounded-xl border border-c-line bg-c-surface"

export function CommentThread({ className = "" }: { className?: string }) {
  return (
    <div className={`${card} p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-c-brand-soft text-c-brand" aria-hidden><Cake className="h-6 w-6" /></div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Chocolate cake, 1 kg</p>
          <p className="text-xs text-c-muted">Your reel · 3 new comments</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4 text-c-muted" aria-hidden><Heart className="h-4 w-4" /><MessageCircle className="h-4 w-4" /><Send className="h-4 w-4" /></div>
      <div className="mt-3 space-y-2">
        <p className="flex items-start gap-2 text-sm text-c-muted"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-c-soft text-[10px] font-semibold" aria-hidden>S</span><span><b>sana_m</b> Looks so good!</span></p>
        <p className="celra-pop flex items-start gap-2 rounded-xl bg-c-brand-soft px-2.5 py-2 text-sm" style={{ ["--d" as string]: "0.2s" }}><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-c-brand text-[10px] font-bold text-c-bg" aria-hidden>R</span><span><b>riya.k</b> price?</span></p>
        <p className="flex items-start gap-2 text-sm text-c-muted"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-c-soft text-[10px] font-semibold" aria-hidden>A</span><span><b>amit.p</b> Link please</span></p>
      </div>
    </div>
  )
}

export function DmCard({ className = "" }: { className?: string }) {
  return (
    <div className={`${card} p-4 ${className}`}>
      <p className="mb-2 text-center text-[11px] font-medium text-c-muted">Direct message · today</p>
      <div className="celra-pop max-w-[92%] rounded-2xl rounded-bl-md bg-c-brand px-3.5 py-2.5 text-sm leading-relaxed text-c-bg" style={{ ["--d" as string]: "0.9s" }}>
        Hi Riya! Chocolate cake 1 kg is ₹850. Tap below to order.
      </div>
      <div className="mt-2 inline-flex rounded-full border border-c-brand px-3 py-1 text-xs font-semibold text-c-brand">Order now</div>
      <div className="mt-3 ml-auto w-fit rounded-2xl rounded-br-md bg-c-soft px-3.5 py-2 text-sm">I will take 2!</div>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-c-muted"><CheckCheck className="h-3.5 w-3.5 text-c-brand" aria-hidden /> Seen</p>
      <div className="celra-pop mt-3 inline-flex items-center gap-1.5 rounded-full bg-c-accent px-3 py-1 text-xs font-bold text-c-accent-ink" style={{ ["--d" as string]: "1.6s" }}>
        <ShoppingBag className="h-3.5 w-3.5" aria-hidden /> Order placed
      </div>
    </div>
  )
}

export function StatsCard({ className = "" }: { className?: string }) {
  const rows = [["Delivered", 96], ["Seen", 78], ["Clicked", 41]] as const
  return (
    <div className={`${card} p-4 ${className}`}>
      <div className="flex items-center justify-between"><p className="text-sm font-semibold">Last 7 days</p><SampleTag>Sample data</SampleTag></div>
      <div className="mt-4 space-y-3.5">
        {rows.map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-xs"><span className="font-medium">{k}</span><span className="text-c-muted">{v}%</span></div>
            <div className="mt-1 h-2.5 rounded-full bg-c-soft" role="img" aria-label={`${k}: ${v} percent (sample)`}><div className="h-full rounded-full bg-c-brand" style={{ width: `${v}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FlowVisual() {
  const node = "rounded-lg border border-c-line bg-c-surface px-3 py-2 text-xs font-semibold shadow-sm"
  return (
    <div className="rounded-2xl border border-c-line bg-c-soft p-5" role="img" aria-label="Sample flow: comment, question, buttons, reply">
      <div className="mx-auto flex max-w-[280px] flex-col items-center gap-0 text-center">
        <div className={`${node} flex items-center gap-2 bg-c-brand-soft text-c-brand`}><Workflow className="h-4 w-4" aria-hidden /> Comment: &ldquo;guide&rdquo;</div>
        <span className="h-5 w-px bg-c-line" aria-hidden />
        <div className={node}>&ldquo;Want the free guide?&rdquo;</div>
        <span className="h-5 w-px bg-c-line" aria-hidden />
        <div className="grid w-full grid-cols-2 gap-3">
          <div className={node}>Yes, send it</div>
          <div className={node}>Not now</div>
        </div>
        <div className="grid w-full grid-cols-2 gap-3"><span className="mx-auto h-5 w-px bg-c-line" aria-hidden /><span className="mx-auto h-5 w-px bg-c-line" aria-hidden /></div>
        <div className="grid w-full grid-cols-2 gap-3">
          <div className={`${node} bg-c-accent text-c-accent-ink`}>Send link</div>
          <div className={node}>Tag: later</div>
        </div>
      </div>
    </div>
  )
}

export function InboxVisual() {
  const rows = [["Riya K.", "I will take 2!", "Order"], ["Sana M.", "Is it eggless?", "Open"], ["Amit P.", "Thanks!", "Done"]]
  return (
    <div className="rounded-2xl border border-c-line bg-c-soft p-5" role="img" aria-label="Sample inbox with three conversations and an order placed note">
      <div className={`${card} divide-y divide-c-line`}>
        {rows.map(([n, m, t]) => (
          <div key={n} className="flex items-center gap-3 p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-c-brand-soft text-sm font-bold text-c-brand" aria-hidden>{n[0]}</span>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{n}</p><p className="truncate text-xs text-c-muted">{m}</p></div>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${t === "Order" ? "bg-c-accent text-c-accent-ink" : "bg-c-soft text-c-muted"}`}>{t}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-c-line px-3 py-2 text-xs text-c-muted"><SampleTag>Sample</SampleTag> Payment link sent, waiting for order</div>
    </div>
  )
}

export function KeywordsVisual() {
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-5">
      <div className="flex flex-wrap gap-2">{["price", "link", "info", "book"].map((k) => <span key={k} className="rounded-full bg-c-brand-soft px-3 py-1 text-sm font-semibold text-c-brand">{k}</span>)}</div>
      <div className="flex items-center gap-2 text-xs text-c-muted"><Tag className="h-4 w-4" aria-hidden /> Each word can send a different DM</div>
      <div className={`${card} px-3 py-2 text-sm`}>Comment contains <b>&ldquo;price&rdquo;</b> → send price card</div>
    </div>
  )
}

export function StoryVisual() {
  return (
    <div className="flex h-full items-center justify-center gap-4 p-5">
      <div className="grid h-[150px] w-[88px] place-items-end rounded-xl bg-c-brand p-2 text-[10px] font-semibold text-c-bg" aria-hidden>Your story</div>
      <div className="space-y-2 text-sm">
        <div className="w-fit rounded-2xl rounded-bl-md bg-c-soft px-3 py-1.5">Where can I buy?</div>
        <div className="ml-4 w-fit rounded-2xl rounded-br-md bg-c-brand px-3 py-1.5 text-c-bg">Here you go: shop link</div>
      </div>
    </div>
  )
}

export function FollowGateVisual() {
  return (
    <div className="flex h-full flex-col justify-center gap-3 p-5 text-sm">
      <div className={`${card} flex items-center gap-3 px-3 py-2.5`}><UserPlus className="h-5 w-5 text-c-brand" aria-hidden /> Please follow us first</div>
      <div className="flex justify-center text-c-muted" aria-hidden><CircleDot className="h-4 w-4" /></div>
      <div className={`${card} flex items-center gap-3 px-3 py-2.5`}><Lock className="h-5 w-5 text-c-brand" aria-hidden /> Link unlocks after the follow</div>
    </div>
  )
}

export function ReportVisual() {
  const h = [30, 46, 38, 62, 54, 78, 70]
  return (
    <div className="flex h-full flex-col justify-end p-5">
      <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Comments to clicks</p><SampleTag>Sample data</SampleTag></div>
      <div className="flex h-24 items-end gap-2" role="img" aria-label="Sample bar chart rising over seven days">
        {h.map((v, i) => <div key={i} className="flex-1 rounded-t bg-c-brand" style={{ height: `${v}%`, opacity: 0.45 + i * 0.09 }} />)}
      </div>
    </div>
  )
}

export function SetupVisual() {
  const steps = ["Connect Instagram", "Pick a reel and a word", "Write your DM, switch on"]
  return (
    <div className="rounded-xl bg-c-surface p-5 text-c-ink" role="img" aria-label={`${BRAND_NAME} setup in three steps`}>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3 rounded-lg border border-c-line bg-c-bg px-3 py-3 text-sm font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-c-brand text-xs font-bold text-c-bg">{i + 1}</span>{s}
            <CheckCheck className="ml-auto h-4 w-4 text-c-brand" aria-hidden />
          </li>
        ))}
      </ol>
    </div>
  )
}
