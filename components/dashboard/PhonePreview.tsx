"use client"

import { useEffect, useState } from "react"
import { Heart, MessageCircle, Send, Bookmark, ChevronLeft, Phone, Video, Image as ImageIcon, MoreHorizontal, Smile } from "lucide-react"

export interface PhonePreviewData {
  triggerSource: "comment" | "dm" | "story" | "live"
  storyTriggerType?: "mention" | "reaction" | "reply"
  replyToAll: boolean
  keywords: string[]
  media?: { thumb?: string; caption?: string } | null
  type: "text" | "card" | "sequence" | "leadgen"
  text: string
  card: { title: string; subtitle: string; image: string; buttons: { title: string }[] }
  steps: { text: string; delay_seconds: number }[]
  questions: { prompt: string }[]
  closing: string
}

type Tab = "post" | "comments" | "story" | "dm"

const TAB_LABEL: Record<Tab, string> = { post: "Post", comments: "Comments", story: "Story", dm: "DM" }

function tabsFor(src: PhonePreviewData["triggerSource"]): Tab[] {
  if (src === "story") return ["story", "dm"]
  if (src === "dm") return ["dm"]
  return ["post", "comments", "dm"] // comment + live
}

const showText = (t: string) => t.replace(/\{link:[a-z0-9]+\}/gi, "🔗 tracked link")

function Avatar({ src, size = 28 }: { src?: string | null; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />
  ) : (
    <div
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full bg-gradient-to-tr from-amber-300 via-pink-500 to-indigo-500"
    />
  )
}

function Img({ src, className, label }: { src?: string; className?: string; label?: string }) {
  const [bad, setBad] = useState(false)
  useEffect(() => setBad(false), [src])
  if (src && !bad) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" onError={() => setBad(true)} className={`object-cover ${className || ""}`} />
  }
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-pink-100 via-orange-100 to-violet-100 text-zinc-400 ${className || ""}`}>
      <div className="flex flex-col items-center gap-1 text-[10px]">
        <ImageIcon className="h-5 w-5" />
        {label}
      </div>
    </div>
  )
}

/**
 * Live Instagram-style phone shown beside the rule form. Everything here is a preview
 * of what the follower will see; nothing is sent.
 */
export function PhonePreview({ userId, data, autoTab }: { userId: string; data: PhonePreviewData; autoTab?: Tab }) {
  const tabs = tabsFor(data.triggerSource)
  const [tab, setTab] = useState<Tab>(autoTab && tabs.includes(autoTab) ? autoTab : tabs[0])
  const [avatar, setAvatar] = useState<string | null>(null)
  const [username, setUsername] = useState("yourbrand")

  useEffect(() => {
    try {
      const n = localStorage.getItem("ig_username")
      if (n) setUsername(n)
    } catch {}
    if (!userId) return
    fetch(`/api/instagram/profile-picture?userId=${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.profilePictureUrl && setAvatar(d.profilePictureUrl))
      .catch(() => {})
  }, [userId])

  useEffect(() => {
    if (autoTab && tabs.includes(autoTab)) setTab(autoTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTab, data.triggerSource])
  useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.triggerSource])

  const kw = data.keywords[0]
  const followerSays = data.replyToAll || !kw ? (data.triggerSource === "dm" ? "Hi" : "Love this! 😍") : kw
  const emptyBubble = (t: string) => (
    <div className="ml-auto max-w-[200px] rounded-2xl border border-dashed border-zinc-300 px-3 py-2 text-[11px] text-zinc-400">{t}</div>
  )

  /* ---------------- screens ---------------- */
  const Post = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-3 py-2">
        <Avatar src={avatar} size={26} />
        <span className="text-[12px] font-semibold">{username}</span>
        <MoreHorizontal className="ml-auto h-4 w-4 text-zinc-500" />
      </div>
      <Img src={data.media?.thumb} className="aspect-square w-full" label={data.media ? "" : "Any post or reel"} />
      <div className="flex items-center gap-3 px-3 pt-2.5 text-zinc-800">
        <Heart className="h-5 w-5" />
        <MessageCircle className="h-5 w-5" />
        <Send className="h-5 w-5" />
        <Bookmark className="ml-auto h-5 w-5" />
      </div>
      <p className="px-3 pt-2 text-[11px] leading-snug">
        <b>{username}</b> {data.media?.caption ? data.media.caption.slice(0, 80) : "Your post or reel"}
      </p>
      <p className="px-3 pt-1 text-[11px] text-zinc-400">
        {data.replyToAll ? "Every comment" : kw ? `Comment “${kw}” to get the DM` : "Add a keyword on the left"}
      </p>
    </div>
  )

  const Comments = (
    <div className="flex h-full flex-col">
      <div className="py-3 text-center text-[12px] font-semibold">Comments</div>
      <div className="flex-1 space-y-3 px-3">
        <div className="flex gap-2">
          <div className="h-7 w-7 shrink-0 rounded-full bg-zinc-200" />
          <div className="text-[12px] leading-snug">
            <b>your_follower</b> <span className="text-zinc-400">Now</span>
            <div>{followerSays}</div>
            <div className="text-[10px] text-zinc-400">Reply</div>
          </div>
        </div>
        <div className="ml-9 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-[10px] text-emerald-700">📩 They get your DM automatically (see the DM tab)</div>
      </div>
      <div className="m-3 flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-400">
        <Smile className="h-4 w-4" /> Add a comment for {username}…
      </div>
    </div>
  )

  const Story = (
    <div className="relative h-full bg-zinc-100">
      <Img src={data.media?.thumb} className="absolute inset-0 h-full w-full" label={data.media ? "" : "Your story"} />
      <div className="absolute inset-x-3 top-3 h-0.5 rounded bg-white/70" />
      <div className="absolute left-3 top-6 flex items-center gap-2 text-white drop-shadow">
        <Avatar src={avatar} size={24} />
        <span className="text-[11px] font-semibold">{username}</span>
      </div>
      <div className="absolute inset-x-3 bottom-4">
        {data.storyTriggerType === "reaction" ? (
          <div className="flex justify-center gap-2 text-xl">❤️ 🔥 👏</div>
        ) : (
          <div className="rounded-full border border-white/80 bg-black/20 px-3 py-2 text-[11px] text-white">
            {data.storyTriggerType === "reply" ? `Reply: “${kw || "…"}”` : `@${username} mentioned in a story`}
          </div>
        )}
      </div>
    </div>
  )

  const bubbles: React.ReactNode[] = []
  if (data.type === "text") {
    bubbles.push(data.text.trim() ? <Out key="t">{showText(data.text)}</Out> : <div key="e">{emptyBubble("Your message appears here")}</div>)
  } else if (data.type === "card") {
    const has = data.card.title.trim() || data.card.image
    bubbles.push(
      has ? (
        <div key="c" className="ml-auto w-[200px] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
          <Img src={data.card.image || undefined} className="h-24 w-full" label={data.card.image ? "" : "Card image"} />
          <div className="px-3 py-2">
            <div className="text-[12px] font-semibold leading-tight">{data.card.title || "Card title"}</div>
            {data.card.subtitle && <div className="mt-0.5 text-[10px] text-zinc-500">{data.card.subtitle}</div>}
          </div>
          {data.card.buttons.filter((b) => b.title.trim()).map((b, i) => (
            <div key={i} className="border-t border-zinc-200 py-2 text-center text-[11px] font-semibold text-blue-600">{b.title}</div>
          ))}
        </div>
      ) : (
        <div key="e">{emptyBubble("Your card appears here")}</div>
      ),
    )
  } else if (data.type === "sequence") {
    const filled = data.steps.filter((s) => s.text.trim())
    if (!filled.length) bubbles.push(<div key="e">{emptyBubble("Your messages appear here")}</div>)
    filled.forEach((s, i) => {
      if (i > 0) bubbles.push(<div key={`d${i}`} className="text-center text-[9px] text-zinc-400">after {s.delay_seconds}s</div>)
      bubbles.push(<Out key={`s${i}`}>{showText(s.text)}</Out>)
    })
  } else {
    const qs = data.questions.filter((q) => q.prompt.trim())
    if (!qs.length) bubbles.push(<div key="e">{emptyBubble("Your questions appear here")}</div>)
    qs.slice(0, 3).forEach((q, i) => {
      bubbles.push(<Out key={`q${i}`}>{q.prompt}</Out>)
      bubbles.push(<In key={`a${i}`}>…</In>)
    })
    if (data.closing.trim() && qs.length) bubbles.push(<Out key="cl">{data.closing}</Out>)
  }

  const Dm = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
        <ChevronLeft className="h-4 w-4" />
        <Avatar src={avatar} size={24} />
        <span className="text-[12px] font-semibold">{username}</span>
        <Phone className="ml-auto h-4 w-4 text-zinc-600" />
        <Video className="h-4 w-4 text-zinc-600" />
      </div>
      <div className="flex-1 space-y-2 overflow-hidden px-3 py-3">
        {(data.triggerSource === "comment" || data.triggerSource === "live") && (
          <div className="text-center text-[9px] text-zinc-400">Follower commented “{followerSays}” on your post</div>
        )}
        <In>{followerSays}</In>
        {bubbles}
      </div>
      <div className="m-3 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-400">Message…</div>
    </div>
  )

  const screen = tab === "post" ? Post : tab === "comments" ? Comments : tab === "story" ? Story : Dm

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-lime-600">Live preview</p>
      <p className="mb-3 text-[11px] text-muted-foreground">Form bharte hi phone badalta hai.</p>
      <div className="mx-auto h-[560px] w-[280px] overflow-hidden rounded-[38px] border-[7px] border-zinc-200 bg-white text-zinc-900 shadow-xl">
        <div className="mx-auto mt-1.5 h-4 w-20 rounded-full bg-zinc-200" />
        <div className="flex justify-between px-5 pb-1 pt-0.5 text-[9px] font-semibold"><span>12:13</span><span>▂▄▆ 🔋</span></div>
        <div className="h-[calc(100%-34px)] overflow-hidden">{screen}</div>
      </div>
      {tabs.length > 1 && (
        <div className="mx-auto mt-4 flex w-[280px] rounded-full border border-border bg-card p-1 text-[11px]">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-full py-1.5 font-medium transition ${tab === t ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Out({ children }: { children: React.ReactNode }) {
  return <div className="ml-auto w-fit max-w-[200px] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-blue-500 px-3 py-2 text-[12px] leading-snug text-white">{children}</div>
}
function In({ children }: { children: React.ReactNode }) {
  return <div className="w-fit max-w-[200px] rounded-2xl rounded-bl-sm bg-zinc-100 px-3 py-2 text-[12px] leading-snug">{children}</div>
}
