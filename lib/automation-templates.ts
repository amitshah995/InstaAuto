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
      messageText: "Hey! Here's the link you asked for: https://yourwebsite.com",
      name: "Link Request → Auto Reply",
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
      messageText: "Here's your code: WELCOME10 🎉",
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
        { text: "In the meantime, check out our latest offers here: https://yourwebsite.com", delay_seconds: 4 },
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
      messageText: "Our pricing starts at ₹999/mo — want me to send the full breakdown?",
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
      closingMessage: "Thanks! We'll be in touch shortly 🙌",
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
      messageText: "Thanks for watching live! Here's what you asked for: https://yourwebsite.com",
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
        msgA: { type: "message", text: "Great! Our pricing starts at ₹999/mo — want the full breakdown?", delay_seconds: 0, next: null },
        msgB: { type: "message", text: "Awesome! Here's a link to book a demo: https://yourwebsite.com/demo", delay_seconds: 0, next: null },
        msgElse: { type: "message", text: "Sorry, just reply with A or B and I'll help you out!", delay_seconds: 0, next: "cond1" },
      },
    },
  },
  {
    id: "sell-from-dm-flow",
    title: "Sell from a DM keyword",
    description: "One message with a coupon, a short delay, then a reminder — built visually in Flow Builder.",
    triggerSource: "dm",
    goal: "Drive traffic",
    kind: "flow",
    flowContent: {
      triggerType: "keyword",
      triggerValue: "shop, buy",
      startNodeId: "msg1",
      nodes: {
        msg1: { type: "message", text: "Hey! Tap below to get your coupon code for 10% off your first purchase 🎉", delay_seconds: 0, next: "msg2" },
        msg2: { type: "message", text: "Your code is: HAPPY10 — shop now before it expires!", delay_seconds: 3, next: "msg3" },
        msg3: { type: "message", text: "Just a reminder in case you missed it — your 10% off code is still active 👀", delay_seconds: 10, next: null },
      },
    },
  },
]

export const TEMPLATE_GOALS = ["Grow followers", "Engage audience", "Drive traffic", "Capture leads"] as const
