export interface AutomationTemplate {
  id: string
  title: string
  description: string
  triggerSource: 'comment' | 'dm' | 'story' | 'live'
  goal: 'Grow followers' | 'Engage audience' | 'Drive traffic' | 'Capture leads'
  badge?: 'Popular' | 'New'
  // "quick" opens the step-by-step form prefilled (defaults below).
  // "flow" creates a draft automation and opens it straight in the visual
  // Flow Builder canvas, prefilled with flowContent's node graph — for
  // templates that branch or chain multiple messages visually.
  kind?: 'quick' | 'flow'
  defaults?: {
    replyToAll?: boolean
    triggers?: string[]
    storyTriggerType?: 'mention' | 'reaction' | 'reply'
    type?: 'text' | 'card' | 'sequence' | 'leadgen'
    messageText?: string
    steps?: { text: string; delay_seconds: number }[]
    questions?: { field: string; prompt: string }[]
    closingMessage?: string
    checkFollow?: boolean
    name?: string
  }
  // "flow" templates only — matches the shape webhook/route.ts's runFlow()
  // interpreter and the Flow Builder's deserializeFlow() both expect.
  flowContent?: {
    triggerType: 'keyword' | 'wildcard'
    triggerValue: string
    startNodeId: string
    nodes: Record<string, any>
  }
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "reply-all-comments",
    title: "Reply to all comments",
    description: "Auto-reply to every comment on a specific post — great for giveaways or launches.",
    triggerSource: "comment",
    goal: "Engage audience",
    badge: "Popular",
    defaults: {
      replyToAll: true,
      type: "text",
      messageText: "Thanks for your comment! Check your DMs 📥",
      name: "All Comments → Reply",
    },
  },
  {
    id: "auto-dm-link-comments",
    title: "Auto-DM link from comments",
    description: "Send a link when people comment a keyword on a post or reel.",
    triggerSource: "comment",
    goal: "Drive traffic",
    badge: "Popular",
    defaults: {
      triggers: ["link", "info"],
      type: "text",
      messageText: "Hey! Here's the link you asked for: [your link]",
      name: "Link Request → Auto Reply",
    },
  },
  {
    // Indian buyers comment "price", "rate", "kitna" under product posts. Hinglish words are included on purpose.
    id: "comment-price-dm",
    title: "Comment \"price\" → price in DM",
    description: "When someone comments price, rate or kitna, send them your price in a DM (English + Hinglish words).",
    triggerSource: "comment",
    goal: "Drive traffic",
    badge: "New",
    defaults: {
      triggers: ["price", "rate", "cost", "kitna", "kitne ka", "price kya hai"],
      type: "text",
      // [Brackets] are blocked by the form until replaced, so a made-up price is never sent.
      messageText: "Hi! Thanks for asking. The price is [your price]. To order or see more, use this link: [your link]. (This is an automatic reply.)",
      name: "Comment Price → DM",
    },
  },
  {
    id: "comment-booking-dm",
    title: "Comment \"book\" → booking link in DM",
    description: "Send your booking or WhatsApp link when someone comments book, slot or appointment.",
    triggerSource: "comment",
    goal: "Capture leads",
    badge: "New",
    defaults: {
      triggers: ["book", "booking", "appointment", "slot", "slot chahiye", "booking karna"],
      type: "text",
      // Never claims the booking is confirmed: it only hands off a link and asks for a preferred time.
      messageText: "Hi! For booking, use this link: [your booking or WhatsApp link]. You can also reply with the date and time you prefer. (This is an automatic reply.)",
      name: "Comment Book → DM",
    },
  },
  {
    id: "follow-gate-freebie",
    title: "Follow first, then freebie",
    description: "Gate a discount code or download behind a follow — reward followers, not lurkers.",
    triggerSource: "comment",
    goal: "Grow followers",
    defaults: {
      triggers: ["free", "code"],
      type: "text",
      // [Brackets] must be replaced by the owner: the create form blocks "Next" while any remain,
      // so a made-up coupon can never be sent to real people.
      messageText: "Thanks for following! Here's your freebie: [your code or link] 🎉",
      checkFollow: true,
      name: "Follow-Gate Freebie",
    },
  },
  {
    id: "welcome-dm-sequence",
    title: "Respond to all your DMs",
    description: "Auto-send a friendly welcome sequence whenever someone DMs you with no matching keyword.",
    triggerSource: "dm",
    goal: "Engage audience",
    badge: "Popular",
    defaults: {
      replyToAll: true,
      type: "sequence",
      steps: [
        { text: "Hey! Thanks for reaching out 👋 What can I help you with?", delay_seconds: 0 },
        { text: "In the meantime, check out our latest offers here: [your link]", delay_seconds: 4 },
      ],
      name: "Welcome Flow",
    },
  },
  {
    id: "faq-auto-reply",
    title: "Answer FAQs in DM",
    description: "Auto-reply instantly when someone DMs a common question keyword.",
    triggerSource: "dm",
    goal: "Engage audience",
    defaults: {
      triggers: ["price", "pricing", "cost"],
      type: "text",
      messageText: "Our pricing starts at [your price] — want me to send the full breakdown?",
      name: "Pricing FAQ",
    },
  },
  {
    id: "lead-capture-flow",
    title: "Capture leads in DM",
    description: "Ask name, email and phone one at a time, save every answer to Contacts.",
    triggerSource: "dm",
    goal: "Capture leads",
    badge: "New",
    defaults: {
      triggers: ["interested", "info", "price"],
      type: "leadgen",
      questions: [
        { field: "name", prompt: "What's your name?" },
        { field: "email", prompt: "What's your email?" },
        { field: "phone", prompt: "What's the best number to reach you on?" },
      ],
      closingMessage: "Thanks! By sharing your details you agree that we may contact you about your enquiry. 🙌",
      name: "Lead Capture",
    },
  },
  {
    id: "story-mention-thanks",
    title: "Thank story mentions",
    description: "Auto-DM anyone who mentions you in their story.",
    triggerSource: "story",
    goal: "Engage audience",
    defaults: {
      storyTriggerType: "mention",
      type: "text",
      messageText: "Thanks so much for the shoutout! 🙏 Means a lot!",
      name: "Story Mention → Thanks",
    },
  },
  {
    id: "story-reaction-reply",
    title: "React & reply",
    description: "Auto-DM anyone who reacts to your story with an emoji.",
    triggerSource: "story",
    goal: "Engage audience",
    defaults: {
      storyTriggerType: "reaction",
      type: "text",
      messageText: "Haha love that you liked it! What did you think?",
      name: "Story Reaction → Reply",
    },
  },
  {
    id: "live-comment-dm",
    title: "Trigger DMs during Live",
    description: "Auto-DM anyone who comments a keyword while you're live — drop links, collect leads.",
    triggerSource: "live",
    goal: "Drive traffic",
    badge: "New",
    defaults: {
      triggers: ["link", "price"],
      type: "text",
      messageText: "Thanks for watching live! Here's what you asked for: [your link]",
      name: "Live Comment → DM",
    },
  },
  {
    id: "qualify-branching-flow",
    title: "Qualify with a branching flow",
    description: "Ask A or B, then route to a different reply for each answer — built visually in Flow Builder.",
    triggerSource: "dm",
    goal: "Capture leads",
    badge: "New",
    kind: "flow",
    flowContent: {
      triggerType: "wildcard",
      triggerValue: "ALL_DMS",
      startNodeId: "msg1",
      nodes: {
        msg1: { type: "message", text: "Hey! Are you looking for A) Pricing info or B) A demo?", delay_seconds: 0, next: "cond1" },
        cond1: {
          type: "condition",
          branches: [
            { keyword: "a", next: "msgA" },
            { keyword: "b", next: "msgB" },
          ],
          default_next: "msgElse",
        },
        msgA: { type: "message", text: "Great! Our pricing starts at [your price] — want the full breakdown?", delay_seconds: 0, next: null },
        msgB: { type: "message", text: "Awesome! Here's a link to book a demo: [your booking link]", delay_seconds: 0, next: null },
        msgElse: { type: "message", text: "Sorry, just reply with A or B and I'll help you out!", delay_seconds: 0, next: "cond1" },
      },
    },
  },
  {
    id: "sell-from-dm-flow",
    title: "Sell from a DM keyword",
    description: "A short welcome, then a question about what they want — built visually in Flow Builder. Add your own offer or link in the Flow Builder.",
    triggerSource: "dm",
    goal: "Drive traffic",
    kind: "flow",
    flowContent: {
      triggerType: "keyword",
      triggerValue: "shop, buy",
      startNodeId: "msg1",
      nodes: {
        // No coupon code and no urgency wording on purpose: add your own real offer or link in the Flow Builder.
        msg1: { type: "message", text: "Hey! Thanks for messaging us 🎉 (this is an automatic reply)", delay_seconds: 0, next: "msg2" },
        msg2: { type: "message", text: "Tell us which product you're interested in and we'll send you the details.", delay_seconds: 3, next: null },
      },
    },
  },
]

export const TEMPLATE_GOALS = ["Grow followers", "Engage audience", "Drive traffic", "Capture leads"] as const
