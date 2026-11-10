"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, Lock, Film, ArrowRight, ArrowLeft, Check, Sparkles, MessageCircle, Send, AtSign, Heart, MessageSquare, ListOrdered, Clock, ListChecks, QrCode as QrCodeIcon } from "lucide-react"
import { TagInput } from "@/components/ui/tag-input"
import type { AutomationTemplate } from "@/lib/automation-templates"
import { toast } from "sonner"
import { hasPlaceholders } from "@/lib/audit/recommendations"
import { PhonePreview } from "@/components/dashboard/PhonePreview"
import { RefLinkField } from "@/components/dashboard/RefLinkField"
import { isValidRefCode } from "@/lib/automations/referral"
import { CommentScopeField } from "@/components/dashboard/CommentScopeField"
import type { CommentScope } from "@/lib/automations/comment-scope"
import { CardCarouselEditor, cardDraftToContent, newCardDraft, type CardDraft } from "@/components/dashboard/CardCarouselEditor"
import { QuickRepliesField, quickRepliesToContent, type QuickReplyDraft } from "@/components/dashboard/QuickRepliesField"
import { PublicReplyField, defaultPublicReplyDraft, publicReplyToContent } from "@/components/dashboard/PublicReplyField"

interface CreateRuleFormProps {
  userId: string
  /** Instagram username of the connected account (without @), needed to show the ref link. */
  username?: string | null
  triggerSource: 'comment' | 'dm' | 'story' | 'live'
  onSuccess: () => void
  template?: AutomationTemplate | null
  /**
   * Strict mode is used for rules suggested by the Instagram Audit. A suggested rule must be tied to ONE post
   * (otherwise it would fire on every post) and every [bracketed] placeholder must be replaced before it can go live.
   */
  strict?: boolean
}

export function CreateRuleForm({ userId, username, triggerSource, onSuccess, template, strict }: CreateRuleFormProps) {
  const [step, setStep] = useState(1)
  const d = template?.defaults

  // Step 1: Trigger
  const [replyToAll, setReplyToAll] = useState(d?.replyToAll ?? false)
  // DM rules can also start from an ig.me link or QR code carrying a ref code (see lib/automations/referral.ts).
  const [refMode, setRefMode] = useState(false)
  const [refCode, setRefCode] = useState("")
  const [triggers, setTriggers] = useState<string[]>(d?.triggers ?? [])
  const [storyTriggerType, setStoryTriggerType] = useState<'mention' | 'reaction' | 'reply'>(d?.storyTriggerType ?? 'mention')
  const [selectedReel, setSelectedReel] = useState<any | null>(null)
  // Comment rules: one post, all posts, or the next post you publish (see lib/automations/comment-scope.ts).
  const [commentScope, setCommentScope] = useState<CommentScope>(strict || d?.replyToAll ? "specific" : "all")
  const [showReelPicker, setShowReelPicker] = useState(false)

  // Step 2: Response
  const [type, setType] = useState<"text" | "card" | "sequence" | "leadgen">(d?.type ?? "text")
  const [messageText, setMessageText] = useState(d?.messageText ?? "")
  // One card or a carousel (up to 10): see components/dashboard/CardCarouselEditor.tsx
  const [cards, setCards] = useState<CardDraft[]>(() => [newCardDraft()])
  const [textChips, setTextChips] = useState<QuickReplyDraft[]>([])
  const [steps, setSteps] = useState<{ id: string; text: string; delay_seconds: number; chips?: QuickReplyDraft[] }[]>(
    d?.steps?.length ? d.steps.map((s, i) => ({ id: String(i + 1), ...s })) : [{ id: "1", text: "", delay_seconds: 0 }],
  )
  const [questions, setQuestions] = useState<{ id: string; field: string; prompt: string }[]>(
    d?.questions?.length ? d.questions.map((q, i) => ({ id: String(i + 1), ...q })) : [{ id: "1", field: "name", prompt: "What's your name?" }],
  )
  const [closingMessage, setClosingMessage] = useState(d?.closingMessage ?? "Thanks! We'll get back to you shortly.")

  // Step 3: Settings
  const [name, setName] = useState(d?.name ?? "")
  const [checkFollow, setCheckFollow] = useState(d?.checkFollow ?? false)
  const [oncePerPerson, setOncePerPerson] = useState(false)
  const [publicReply, setPublicReply] = useState(defaultPublicReplyDraft())

  // Media
  const [reels, setReels] = useState<any[]>([])
  const [loadingReels, setLoadingReels] = useState(false)
  // true when /api/instagram/media failed (expired login, rate limit) so strict mode can say so
  const [reelsFailed, setReelsFailed] = useState(false)

  useEffect(() => {
    if (userId) loadReels()
  }, [userId])

  // Auto-generate name suggestion
  useEffect(() => {
    if (name) return // Don't overwrite user's custom name
    if (replyToAll) {
      setName(triggerSource === 'dm' ? `All DMs → Reply` : triggerSource === 'live' ? `All Live Comments → DM` : `All Comments → Reply`)
    } else if (triggers.length > 0) {
      setName(`${triggers.slice(0, 2).join(", ")} → Auto Reply`)
    }
  }, [triggers, replyToAll])

  const loadReels = async () => {
    try {
      setLoadingReels(true)
      const res = await fetch(`/api/instagram/media?userId=${userId}`)
      if (!res.ok) setReelsFailed(true)
      const responseJson = await res.json()
      if (responseJson.data && Array.isArray(responseJson.data)) setReels(responseJson.data)
      else if (Array.isArray(responseJson)) setReels(responseJson)
    } catch (err) {
      setReelsFailed(true)
      console.error("[v0] Failed to load reels:", err)
    } finally {
      setLoadingReels(false)
    }
  }

  const handleAddStep = () => {
    if (steps.length >= 5) return
    setSteps([...steps, { id: Date.now().toString(), text: "", delay_seconds: 3 }])
  }

  const updateStep = (id: string, field: "text" | "delay_seconds", value: string | number) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }
  const setStepChips = (id: string, chips: QuickReplyDraft[]) => setSteps(steps.map((s) => (s.id === id ? { ...s, chips } : s)))

  const removeStep = (id: string) => {
    if (steps.length <= 1) return
    setSteps(steps.filter((s) => s.id !== id))
  }

  const handleAddQuestion = () => {
    if (questions.length >= 8) return
    setQuestions([...questions, { id: Date.now().toString(), field: "", prompt: "" }])
  }

  const updateQuestion = (id: string, field: "field" | "prompt", value: string) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)))
  }

  const removeQuestion = (id: string) => {
    if (questions.length <= 1) return
    setQuestions(questions.filter((q) => q.id !== id))
  }

  // Validation per step
  const canProceedStep1 = () => {
    if (strict && !selectedReel) {
      if (reelsFailed) {
        toast.error("Could not load your posts", { description: "Reconnect Instagram, then try again." })
      } else if (!loadingReels && reels.length === 0) {
        toast.error("No posts found", { description: "Publish a post that asks people to comment this keyword first, then come back." })
      } else {
        toast.error("Pick the post this applies to", { description: "Audit suggestions work on one post at a time." })
      }
      return false
    }
    const isStoryMentionOrReaction = triggerSource === 'story' && (storyTriggerType === 'mention' || storyTriggerType === 'reaction')
    if (triggerSource === 'comment' && replyToAll && commentScope === 'all') {
      toast.error("Choose which post", { description: "Reply-All needs one post, or your next post. It cannot run on every post." })
      return false
    }
    if (triggerSource === 'comment' && commentScope === 'specific' && !selectedReel) {
      toast.error("Select a Post", { description: "Pick the post or reel this applies to, or choose another option." })
      return false
    }
    if (triggerSource === 'dm' && refMode) {
      if (!isValidRefCode(refCode)) {
        toast.error("Add a link code", { description: "Use lowercase letters, numbers, - or _ (for example summer-sale)." })
        return false
      }
      return true
    }
    if (!replyToAll && !isStoryMentionOrReaction && triggers.length === 0) {
      toast.error("Add Keywords", { description: "Add at least one keyword trigger." })
      return false
    }
    return true
  }

  const canProceedStep2 = () => {
    // Block while [placeholders] remain: always in strict (audit) mode, and for any template that ships with them.
    const templateHasPlaceholders = !!d?.messageText && hasPlaceholders(d.messageText)
    if ((strict || templateHasPlaceholders) && type === "text" && hasPlaceholders(messageText)) {
      toast.error("Replace the [bracketed] parts", { description: "Put your real link, price or brand name instead of the [brackets]." })
      return false
    }
    // Same guard for multi-message sequences: a template step like "[your link]" must be replaced before saving.
    if (type === "sequence" && (strict || d?.steps?.some((st) => hasPlaceholders(st.text))) && steps.some((st) => hasPlaceholders(st.text))) {
      toast.error("Replace the [bracketed] parts", { description: "Put your real link or price instead of the [brackets]." })
      return false
    }
    if (type === "text" && !messageText.trim()) {
      toast.error("Missing Reply", { description: "Enter the message to auto-send." })
      return false
    }
    if (type === "card" && cards.some((c) => !c.title.trim())) {
      toast.error("Missing Title", { description: cards.length > 1 ? "Every card in the carousel needs a title." : "Rich cards need a title." })
      return false
    }
    if (type === "card" && cards.some((c) => !c.subtitle.trim() && !c.image.trim() && c.buttons.filter((b) => b.title.trim()).length === 0)) {
      toast.error("Add a bit more", { description: "Instagram needs each card to have an image, a subtitle or a button besides the title." })
      return false
    }
    if (type === "sequence" && !steps.some((s) => s.text.trim())) {
      toast.error("Missing Messages", { description: "Add text to at least one step." })
      return false
    }
    if (type === "leadgen" && !questions.some((q) => q.field.trim() && q.prompt.trim())) {
      toast.error("Missing Questions", { description: "Add at least one question with a field name and prompt." })
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Name Required", { description: "Give your automation a name." })
      return
    }

    const content: any = { check_follow: checkFollow }
    if ((triggerSource === 'comment' || (triggerSource === 'dm' && refMode)) && oncePerPerson) content.once_per_person = true
    if (triggerSource === 'comment') content.comment_scope = commentScope
    if (triggerSource === 'comment') content.public_reply = publicReplyToContent(publicReply)
    if (type === "leadgen") {
      content.questions = questions
        .filter((q) => q.field.trim() && q.prompt.trim())
        .map((q) => ({ field: q.field.trim(), prompt: q.prompt.trim() }))
      if (closingMessage.trim()) content.closing_message = closingMessage.trim()
    } else if (type === "sequence") {
      content.steps = steps
        .filter((s) => s.text.trim())
        .map((s, idx) => {
          const chips = quickRepliesToContent(s.chips ?? [], true)
          return { type: "text", text: s.text.trim(), delay_seconds: idx === 0 ? 0 : s.delay_seconds || 0, ...(chips.length ? { quick_replies: chips } : {}) }
        })
    } else if (type === "text") {
      content.message = messageText
      const chips = quickRepliesToContent(textChips, true)
      if (chips.length) content.quick_replies = chips
    } else {
      // One card keeps the exact old shape (`card`). Several cards are saved as `cards` (the API also mirrors the first
      // into `card` so older readers still work).
      const built = cards.map(cardDraftToContent)
      if (built.length === 1) content.card = built[0]
      else content.cards = built
    }

    try {
      const loadingToast = toast.loading("Creating...")
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          name,
          trigger_source: triggerSource,
          trigger_type: triggerSource === 'dm' && refMode
            ? "ref"
            : replyToAll
              ? (triggerSource === 'dm' ? "wildcard" : "reply_all")
              : (triggerSource === 'story' ? storyTriggerType : "keyword"),
          trigger_value: triggerSource === 'dm' && refMode ? refCode : replyToAll ? (triggerSource === 'dm' ? "ALL_DMS" : "ALL_COMMENTS") :
            (triggerSource === 'story' && storyTriggerType === 'mention') ? "ALL_MENTIONS" :
              (triggerSource === 'story' && storyTriggerType === 'reaction' && triggers.length === 0) ? "ALL_REACTIONS" :
                triggers.length > 0 ? triggers.join(", ") : "ALL",
          content,
          specific_media_id: triggerSource === 'comment' ? (commentScope === 'specific' ? selectedReel?.id || null : null) : (selectedReel?.id || null),
        }),
      })

      toast.dismiss(loadingToast)
      if (res.ok) {
        toast.success("Automation Created! 🎉")
        // Reset everything
        setStep(1)
        setName("")
        setTriggers([])
        setReplyToAll(false)
        setRefMode(false)
        setRefCode("")
        setMessageText("")
        setTextChips([])
        setCards([newCardDraft()])
        setSteps([{ id: "1", text: "", delay_seconds: 0 }])
        setQuestions([{ id: "1", field: "name", prompt: "What's your name?" }])
        setClosingMessage("Thanks! We'll get back to you shortly.")
        setType("text")
        setSelectedReel(null)
        setCommentScope(strict ? "specific" : "all")
        setCheckFollow(false)
        setOncePerPerson(false)
        setPublicReply(defaultPublicReplyDraft())
        onSuccess()
      } else {
        const apiError = await res.json().then((j: any) => j?.error).catch(() => null)
        toast.error("Failed", { description: typeof apiError === "string" && res.status === 400 ? apiError : "Please try again." })
      }
    } catch (err) {
      toast.error("Network Error")
    }
  }

  // --- SUB COMPONENTS ---

  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-6">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <button
            onClick={() => {
              if (s < step) setStep(s)
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
              s === step
                ? "bg-foreground text-background scale-110 shadow-lg shadow-foreground/10"
                : s < step
                  ? "bg-brand/20 text-brand border border-brand/30 cursor-pointer hover:scale-105"
                  : "bg-secondary text-muted-foreground border border-border"
            }`}
          >
            {s < step ? <Check className="w-3.5 h-3.5" /> : s}
          </button>
          {s < 3 && (
            <div className={`w-8 h-px transition-colors duration-500 ${s < step ? "bg-brand/50" : "bg-border"}`} />
          )}
        </div>
      ))}
      <span className="text-[10px] text-neutral-500 ml-2 uppercase tracking-wider font-bold">
        {step === 1 ? "Trigger" : step === 2 ? "Response" : "Launch"}
      </span>
    </div>
  )

  const ReelPicker = () => {
    const filteredReels = triggerSource === 'story'
      ? reels.filter((r: any) => r.media_type === 'STORY' || r.media_product_type === 'STORY')
      : reels

    if (loadingReels) {
      return (
        <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-popover border border-border rounded-xl text-center z-50">
          <p className="text-muted-foreground text-sm">Loading media...</p>
        </div>
      )
    }

    if (filteredReels.length === 0) {
      return (
        <div className="absolute top-full left-0 right-0 mt-2 p-4 bg-popover border border-border rounded-xl text-center z-50">
          <p className="text-muted-foreground text-sm">{triggerSource === 'story' ? 'No active stories' : 'No posts found'}</p>
        </div>
      )
    }

    return (
      <div className="absolute top-full left-0 right-0 mt-2 max-h-56 overflow-y-auto bg-popover border border-border rounded-xl z-50 shadow-2xl">
        {filteredReels.map((reel: any) => {
          const isStory = reel.media_type === 'STORY' || reel.media_product_type === 'STORY'
          if (triggerSource === 'story' && !isStory) return null
          const label = isStory ? 'Story' : reel.media_type === 'VIDEO' ? 'Reel' : reel.media_type === 'CAROUSEL_ALBUM' ? 'Carousel' : 'Post'

          return (
            <button
              key={reel.id}
              type="button"
              onClick={() => { setSelectedReel(reel); setShowReelPicker(false) }}
              className="w-full p-3 flex items-center gap-3 hover:bg-secondary transition-colors text-left border-b border-border last:border-0"
            >
              {reel.media_url || reel.thumbnail_url ? (
                <img src={reel.thumbnail_url || reel.media_url} alt="" className="w-10 h-10 rounded object-cover opacity-80" />
              ) : (
                <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                  <Film className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{reel.caption || 'Untitled'}</p>
                <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  // DM Preview Bubble
  // --- STEP RENDERS ---

  const renderStep1 = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">
          {triggerSource === 'comment' ? '💬 When to reply?' :
            triggerSource === 'dm' ? '📩 When to reply?' :
              triggerSource === 'live' ? '📡 Live comment trigger' :
                '📸 Story trigger'}
        </h3>
        <p className="text-xs text-muted-foreground">
          {triggerSource === 'comment'
            ? 'Auto-reply when someone comments these keywords.'
            : triggerSource === 'dm'
              ? 'Auto-reply when someone DMs these keywords.'
              : triggerSource === 'live'
                ? 'Auto-DM when someone comments these keywords while you are live. Instagram only allows this private reply during the broadcast, so nothing is sent once you end the live. Needs the live_comments webhook field turned on for your app.'
                : 'Engage when someone interacts with your story.'}
        </p>
      </div>

      {/* Story type selector */}
      {triggerSource === 'story' && (
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: 'mention' as const, icon: <AtSign className="w-4 h-4" />, label: 'Mentions' },
            { key: 'reaction' as const, icon: <Heart className="w-4 h-4" />, label: 'Reactions' },
            { key: 'reply' as const, icon: <MessageSquare className="w-4 h-4" />, label: 'Replies' },
          ]).map(({ key, icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStoryTriggerType(key)}
              className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1.5 ${
                storyTriggerType === key
                  ? 'border-foreground bg-foreground text-background shadow-lg shadow-foreground/10'
                  : 'border-border text-muted-foreground hover:bg-secondary hover:border-border'
              }`}
            >
              {icon}
              <span className="text-[11px] font-bold">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Reply to all toggle — comments and live comments */}
      {(triggerSource === 'comment' || triggerSource === 'live') && (
        <button
          type="button"
          onClick={() => {
            // "All posts" + reply to every comment would answer every comment on the account: move to one post instead.
            if (!replyToAll && triggerSource === 'comment' && commentScope === 'all') setCommentScope('specific')
            setReplyToAll(!replyToAll)
          }}
          className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${
            replyToAll ? 'border-brand/50 bg-brand-soft' : 'border-border hover:border-muted-foreground/30 hover:bg-secondary'
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            replyToAll ? 'bg-brand-soft text-brand' : 'bg-secondary text-muted-foreground'
          }`}>
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="text-left flex-1">
            <p className={`text-sm font-bold ${replyToAll ? 'text-brand' : 'text-foreground'}`}>{triggerSource === 'live' ? 'Reply to every live comment' : 'Reply to All Comments'}</p>
            <p className="text-[11px] text-muted-foreground">{triggerSource === 'live' ? 'Send your DM to everyone who comments during the live (keywords are ignored)' : 'Auto-reply to every comment on a specific post'}</p>
          </div>
          <div className={`w-5 h-5 rounded-full border-2 transition-all ${
            replyToAll ? 'border-brand bg-brand' : 'border-border'
          }`}>
            {replyToAll && <Check className="w-3 h-3 text-white m-auto mt-0.5" />}
          </div>
        </button>
      )}

      {/* Start from a link or QR code — DMs only */}
      {triggerSource === 'dm' && (
        <button
          type="button"
          onClick={() => {
            const next = !refMode
            setRefMode(next)
            if (next) { setReplyToAll(false); setOncePerPerson(true) } else setOncePerPerson(false)
          }}
          aria-pressed={refMode}
          className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${
            refMode ? 'border-brand/50 bg-brand-soft' : 'border-border hover:border-muted-foreground/30 hover:bg-secondary'
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${refMode ? 'bg-brand-soft text-brand' : 'bg-secondary text-muted-foreground'}`}>
            <QrCodeIcon className="w-5 h-5" />
          </div>
          <div className="text-left flex-1">
            <p className={`text-sm font-bold ${refMode ? 'text-brand' : 'text-foreground'}`}>Start from a link or QR code</p>
            <p className="text-[11px] text-muted-foreground">Share a link that opens a chat with you and runs this automation. Contacts are labelled with the link they came from.</p>
          </div>
          <div className={`w-5 h-5 rounded-full border-2 transition-all ${refMode ? 'border-brand bg-brand' : 'border-border'}`}>
            {refMode && <Check className="w-3 h-3 text-white m-auto mt-0.5" />}
          </div>
        </button>
      )}

      {triggerSource === 'dm' && refMode && <RefLinkField username={username} code={refCode} onChange={setRefCode} nameHint={name} />}

      {/* Reply to all toggle — DMs only */}
      {triggerSource === 'dm' && !refMode && (
        <button
          type="button"
          onClick={() => setReplyToAll(!replyToAll)}
          className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${
            replyToAll ? 'border-brand/50 bg-brand-soft' : 'border-border hover:border-muted-foreground/30 hover:bg-secondary'
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            replyToAll ? 'bg-brand-soft text-brand' : 'bg-secondary text-muted-foreground'
          }`}>
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="text-left flex-1">
            <p className={`text-sm font-bold ${replyToAll ? 'text-brand' : 'text-foreground'}`}>Reply to ALL DMs</p>
            <p className="text-[11px] text-muted-foreground">Auto-reply to every DM you receive, no keyword needed</p>
          </div>
          <div className={`w-5 h-5 rounded-full border-2 transition-all ${
            replyToAll ? 'border-brand bg-brand' : 'border-border'
          }`}>
            {replyToAll && <Check className="w-3 h-3 text-white m-auto mt-0.5" />}
          </div>
        </button>
      )}

      {/* Keyword input — conditional */}
      {!(triggerSource === 'dm' && refMode) && !(replyToAll && (triggerSource === 'comment' || triggerSource === 'dm' || triggerSource === 'live')) && !(triggerSource === 'story' && storyTriggerType === 'mention') && (
        <div className="space-y-2">
          <Label className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider ml-1">
            {triggerSource === 'story' && storyTriggerType === 'reaction' ? 'Emoji Filter (optional)' : 'Keywords'}
          </Label>
          <TagInput
            value={triggers}
            onChange={setTriggers}
            placeholder={
              triggerSource === 'comment' ? 'e.g. hello, price, link' :
                triggerSource === 'story' && storyTriggerType === 'reaction' ? 'e.g. ❤️, 🔥, 👍' :
                  'e.g. hello, hi, menu'
            }
          />
          <p className="text-[10px] text-muted-foreground ml-1">Press Enter or comma to add</p>
        </div>
      )}

      {triggerSource === 'comment' && (
        <CommentScopeField value={commentScope} onChange={setCommentScope} disabled={strict} disabledKeys={replyToAll ? ['all'] : []} />
      )}

      {/* Post/Reel picker */}
      {((triggerSource === 'comment' && commentScope === 'specific') || triggerSource === 'story') && (
        <div className="space-y-2">
          <Label className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider ml-1">
            {triggerSource === 'comment' || replyToAll || strict ? 'Select Post (Required)' :
              triggerSource === 'story' ? 'Story (Optional)' : 'Post/Reel (Optional)'}
          </Label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowReelPicker(!showReelPicker)}
              className="w-full p-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors text-left flex items-center gap-3"
            >
              {selectedReel ? (
                <>
                  {(selectedReel.media_url || selectedReel.thumbnail_url) && (
                    <img src={selectedReel.thumbnail_url || selectedReel.media_url} alt="" className="w-10 h-10 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{selectedReel.caption || 'No caption'}</p>
                    <p className="text-[10px] text-brand font-semibold">✓ Selected</p>
                  </div>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {replyToAll || strict ? '📌 Select a post...' : '📌 Optional — applies to any post (tap to pick)'}
                </span>
              )}
            </button>
            {showReelPicker && <ReelPicker />}
          </div>
        </div>
      )}
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">✉️ What to send?</h3>
        <p className="text-xs text-muted-foreground">Type the auto-reply message — this goes as a DM.</p>
      </div>

      {/* Response type toggle */}
      <div className={`grid gap-2 ${triggerSource === 'dm' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        <button
          type="button"
          onClick={() => setType("text")}
          className={`p-3 rounded-xl border transition-all flex items-center gap-2 ${
            type === "text"
              ? "border-foreground bg-foreground text-background shadow-lg shadow-foreground/10"
              : "border-border text-muted-foreground hover:bg-secondary hover:border-border"
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span className="text-sm font-bold">Simple Text</span>
        </button>
        <button
          type="button"
          onClick={() => setType("card")}
          className={`p-3 rounded-xl border transition-all flex items-center gap-2 ${
            type === "card"
              ? "border-foreground bg-foreground text-background shadow-lg shadow-foreground/10"
              : "border-border text-muted-foreground hover:bg-secondary hover:border-border"
          }`}
        >
          <Send className="w-4 h-4" />
          <span className="text-sm font-bold">Card / Carousel</span>
        </button>
        <button
          type="button"
          onClick={() => setType("sequence")}
          className={`p-3 rounded-xl border transition-all flex items-center gap-2 ${
            type === "sequence"
              ? "border-foreground bg-foreground text-background shadow-lg shadow-foreground/10"
              : "border-border text-muted-foreground hover:bg-secondary hover:border-border"
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span className="text-sm font-bold">Sequence</span>
        </button>
        {triggerSource === 'dm' && (
          <button
            type="button"
            onClick={() => setType("leadgen")}
            className={`p-3 rounded-xl border transition-all flex items-center gap-2 ${
              type === "leadgen"
                ? "border-foreground bg-foreground text-background shadow-lg shadow-foreground/10"
                : "border-border text-muted-foreground hover:bg-secondary hover:border-border"
            }`}
          >
            <ListChecks className="w-4 h-4" />
            <span className="text-sm font-bold">Lead Qual</span>
          </button>
        )}
      </div>

      {type === "leadgen" ? (
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Ask questions one at a time. Each answer is saved to Contacts — "name", "email" and "phone" map to dedicated fields, anything else (e.g. "budget", "city") is saved as a custom field.
          </p>
          {questions.map((q, idx) => (
            <div key={q.id} className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Question {idx + 1}
                </span>
                {questions.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeQuestion(q.id)}
                    className="h-6 w-6 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <Input
                value={q.field}
                onChange={(e) => updateQuestion(q.id, "field", e.target.value)}
                className="h-8 text-xs bg-background border-border font-mono"
                placeholder="Field name (e.g. name, email, budget)"
              />
              <Input
                value={q.prompt}
                onChange={(e) => updateQuestion(q.id, "prompt", e.target.value)}
                className="h-9 text-sm bg-background border-border"
                placeholder="Question to ask (e.g. What's your email?)"
              />
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleAddQuestion}
            disabled={questions.length >= 8}
            className="w-full h-9 text-xs border border-dashed border-border hover:bg-secondary"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add another question
          </Button>
          <div className="space-y-1.5 pt-1">
            <Label className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Closing Message (optional)</Label>
            <Textarea
              value={closingMessage}
              onChange={(e) => setClosingMessage(e.target.value)}
              className="bg-secondary/30 border-border min-h-[60px] resize-none text-sm"
              placeholder="Sent after the last question is answered..."
            />
          </div>
        </div>
      ) : type === "sequence" ? (
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Send multiple messages one after another, each with its own delay.
          </p>
          {steps.map((s, idx) => (
            <div key={s.id} className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Message {idx + 1}
                </span>
                {steps.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeStep(s.id)}
                    className="h-6 w-6 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <Textarea
                value={s.text}
                onChange={(e) => updateStep(s.id, "text", e.target.value)}
                className="bg-background border-border min-h-[70px] resize-none text-sm"
                placeholder={idx === 0 ? "First message, sent immediately..." : "Next message..."}
              />
              {idx > 0 && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Wait</Label>
                  <Input
                    type="number"
                    min={0}
                    value={s.delay_seconds}
                    onChange={(e) => updateStep(s.id, "delay_seconds", Math.max(0, parseInt(e.target.value) || 0))}
                    className="h-7 w-16 text-xs bg-background border-border"
                  />
                  <Label className="text-[11px] text-muted-foreground">seconds, then send</Label>
                </div>
              )}
              <QuickRepliesField value={s.chips ?? []} onChange={(c) => setStepChips(s.id, c)} compact />
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleAddStep}
            disabled={steps.length >= 5}
            className="w-full h-9 text-xs border border-dashed border-border hover:bg-secondary"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add another message
          </Button>
        </div>
      ) : type === "text" ? (
        <div className="space-y-2">
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="bg-secondary/30 border-border min-h-[100px] focus:bg-secondary/50 focus:ring-1 focus:ring-ring transition-colors resize-none"
            placeholder="Type your auto-reply message here..."
          />
          <p className="text-[10px] text-muted-foreground text-right">{messageText.length}/1000</p>
          <QuickRepliesField value={textChips} onChange={setTextChips} />
        </div>
      ) : (
        <CardCarouselEditor cards={cards} onChange={setCards} />
      )}

    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          Ready to launch!
        </h3>
        <p className="text-xs text-muted-foreground">Name it, set options, and you're good to go.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider ml-1">Automation Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-secondary/30 border-border focus:bg-secondary/50"
          placeholder="e.g. Welcome Reply, Price Info"
        />
      </div>

      <button
        type="button"
        onClick={() => setCheckFollow(!checkFollow)}
        className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${
          checkFollow ? 'border-brand/50 bg-brand-soft' : 'border-border hover:border-muted-foreground/30 hover:bg-secondary'
        }`}
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          checkFollow ? 'bg-brand-soft text-brand' : 'bg-secondary text-muted-foreground'
        }`}>
          <Lock className="w-5 h-5" />
        </div>
        <div className="text-left flex-1">
          <p className={`text-sm font-bold ${checkFollow ? 'text-brand' : 'text-foreground'}`}>Follow Gate</p>
          <p className="text-[11px] text-muted-foreground">Only reply to your followers. We check with Instagram when it allows; if it cannot confirm, the gate works on the honour system.</p>
        </div>
        <div className={`w-5 h-5 rounded-full border-2 transition-all ${
          checkFollow ? 'border-brand bg-brand' : 'border-border'
        }`}>
          {checkFollow && <Check className="w-3 h-3 text-white m-auto mt-0.5" />}
        </div>
      </button>

      {(triggerSource === 'comment' || (triggerSource === 'dm' && refMode)) && (
        <label className="w-full p-4 rounded-xl border border-border hover:border-muted-foreground/30 hover:bg-secondary transition-all flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={oncePerPerson}
            onChange={(e) => setOncePerPerson(e.target.checked)}
            className="mt-1 h-4 w-4 accent-primary cursor-pointer"
          />
          <div className="text-left flex-1">
            <p className="text-sm font-bold text-foreground">{triggerSource === 'dm' ? 'Once per person' : 'Once per person per post'}</p>
            <p className="text-[11px] text-muted-foreground">
              {triggerSource === 'dm'
                ? "If the same person opens this link again, they won't get the messages again"
                : "Repeat comments from the same person on the same post won't get another reply or DM"}
            </p>
          </div>
        </label>
      )}

      {triggerSource === 'comment' && <PublicReplyField value={publicReply} onChange={setPublicReply} />}

      {/* Summary card */}
      <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Summary</p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground font-medium">When:</span>
          <span className="text-foreground font-semibold">
            {triggerSource === 'dm' && refMode ? `Link code: ${refCode || '...'}` : replyToAll ? (triggerSource === 'dm' ? 'Any DM' : triggerSource === 'live' ? 'Any live comment' : 'Any comment') :
              triggerSource === 'story' && storyTriggerType === 'mention' ? 'Story mention' :
                triggers.length > 0 ? triggers.join(", ") : 'All messages'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground font-medium">Reply:</span>
          <span className="text-foreground font-semibold truncate">
            {type === 'leadgen'
              ? `${questions.filter(q => q.field.trim() && q.prompt.trim()).length} question flow`
              : type === 'sequence'
                ? `${steps.filter(s => s.text.trim()).length} messages in sequence`
                : type === 'text'
                  ? messageText.slice(0, 40) + (messageText.length > 40 ? '...' : '')
                  : cards.length > 1 ? `Carousel: ${cards.length} cards` : `Card: ${cards[0]?.title}`}
          </span>
        </div>
        {checkFollow && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground font-medium">Gate:</span>
            <span className="text-warn font-semibold">Followers only (honour system if Instagram cannot verify)</span>
          </div>
        )}
      </div>
    </div>
  )

  // --- MAIN RENDER ---
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
    <div className="min-w-0 space-y-6">
      <StepIndicator />

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        {step > 1 && (
          <Button
            variant="ghost"
            onClick={() => setStep(step - 1)}
            className="flex-1 h-11 rounded-xl border border-border hover:bg-secondary text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        )}

        {step < 3 ? (
          <Button
            onClick={() => {
              if (step === 1 && !canProceedStep1()) return
              if (step === 2 && !canProceedStep2()) return
              setStep(step + 1)
            }}
            className="flex-1 bg-foreground text-background hover:bg-foreground/90 font-bold h-11 rounded-xl shadow-lg shadow-foreground/5 active:scale-95 transition-all"
          >
            Next <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            className="flex-1 bg-brand hover:bg-brand/90 text-brand-foreground font-bold h-11 rounded-xl shadow-lg shadow-black/5 active:scale-95 transition-all"
          >
            <Sparkles className="w-4 h-4 mr-2" /> Create Automation
          </Button>
        )}
      </div>
    </div>
    <div className="lg:sticky lg:top-4 lg:self-start">
      <PhonePreview
        userId={userId}
        autoTab={step === 1 ? (triggerSource === "story" ? "story" : triggerSource === "dm" ? "dm" : "post") : "dm"}
        data={{
          triggerSource,
          storyTriggerType,
          replyToAll,
          keywords: triggers,
          media: selectedReel ? { thumb: selectedReel.thumbnail_url || selectedReel.media_url, caption: selectedReel.caption } : null,
          type,
          text: messageText,
          card: { title: cards[0]?.title ?? "", subtitle: cards[0]?.subtitle ?? "", image: cards[0]?.image ?? "", buttons: (cards[0]?.buttons ?? []).map((b) => ({ title: b.title })) },
          steps: steps.map((x) => ({ text: x.text, delay_seconds: x.delay_seconds })),
          questions: questions.map((q) => ({ prompt: q.prompt })),
          closing: closingMessage,
        }}
      />
    </div>
    </div>
  )
}
