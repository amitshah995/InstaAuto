export interface AutomationTemplate {
  id: string
  title: string
  description: string
  triggerSource: 'comment' | 'dm' | 'story' | 'live'
  goal: 'Grow followers' | 'Engage audience' | 'Drive traffic' | 'Capture leads'
  badge?: 'Popular' | 'New'
  defaults: {
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
]

export const TEMPLATE_GOALS = ["Grow followers", "Engage audience", "Drive traffic", "Capture leads"] as const
