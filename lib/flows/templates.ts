import type { FlowGraph } from "@/lib/flows/engine"

export type FlowTemplate = {
  slug: string
  name: string
  h1: string
  intro: string
  trigger: string // plain-words description of what starts it
  sampleReplies: string[] // what the preview "follower" types
  graph: FlowGraph
  tips: string[]
  faq: [string, string][]
}

const COMMON_FAQ: [string, string][] = [
  ["Does this work on any Instagram account?", "It works on Instagram professional accounts (Business or Creator) connected to DMSpark through the official Instagram API."],
  ["Can I change the messages?", "Yes. Open the flow in the DMSpark builder, edit any message, branch or tag, and test it before it goes live."],
]

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    slug: "comment-to-dm-lead-magnet",
    name: "Comment-to-DM lead magnet",
    h1: "Comment-to-DM flow for sending a free guide",
    intro: "Someone comments a keyword on your post, gets your guide in their DMs, and is tagged as a lead.",
    trigger: "A follower comments your keyword (for example GUIDE) on a post",
    sampleReplies: ["send"],
    graph: {
      startNodeId: "m1",
      nodes: {
        m1: { type: "message", text: "Hey! Thanks for commenting. Want the free guide? Reply SEND and I will drop the link here.", next: "c1" },
        c1: { type: "condition", branches: [{ keyword: "send", next: "t1" }], default_next: "m3" },
        t1: { type: "tag", tag: "lead-magnet", next: "m2" },
        m2: { type: "message", text: "Here you go: [your link]. Tell me if anything is unclear.", next: null },
        m3: { type: "message", text: "No problem. Reply SEND any time and I will share it.", next: null },
      },
    },
    tips: ["Use one clear keyword per post so you can see which post brings leads.", "Ask for a reply before the link: it opens the 24-hour chat window for follow-ups."],
    faq: [["Why ask for a reply before sending the link?", "A reply shows real interest and lets you message the person again inside Instagram's 24-hour window."], ...COMMON_FAQ],
  },
  {
    slug: "price-and-demo-qualifier",
    name: "Price and demo qualifier",
    h1: "DM flow that answers price questions and books demos",
    intro: "A first reply asks what the person needs, then routes them to pricing or a demo and tags the hot ones.",
    trigger: "Someone DMs the word PRICE",
    sampleReplies: ["demo"],
    graph: {
      startNodeId: "m1",
      nodes: {
        m1: { type: "message", text: "Thanks for asking! Do you want pricing or a quick demo? Reply PRICING or DEMO.", next: "c1" },
        c1: { type: "condition", branches: [{ keyword: "pricing", next: "m2" }, { keyword: "demo", next: "t1" }], default_next: "m4" },
        m2: { type: "message", text: "Our plans start at [your price]. Full details: [your link]", next: null },
        t1: { type: "tag", tag: "wants-demo", next: "m3" },
        m3: { type: "message", text: "Great! Pick a time here: [your booking link]", next: null },
        m4: { type: "message", text: "Just reply PRICING or DEMO and I will help.", next: "c1" },
      },
    },
    tips: ["Tag people who ask for a demo, then message them from the Contacts page.", "Keep each message short. People read DMs on their phone."],
    faq: [["What if they type something else?", "The flow has a fallback message that asks again, so nobody is left without a reply."], ...COMMON_FAQ],
  },
  {
    slug: "giveaway-entry",
    name: "Giveaway entry confirmation",
    h1: "DM flow that confirms giveaway entries",
    intro: "Confirm each entry in DMs, collect a tag for every entrant and remind them of the rules.",
    trigger: "A follower comments ENTER on your giveaway post",
    sampleReplies: [],
    graph: {
      startNodeId: "t1",
      nodes: {
        t1: { type: "tag", tag: "giveaway-entrant", next: "m1" },
        m1: { type: "message", text: "You are in! Quick reminder: follow us and tag a friend on the post to keep your entry valid.", next: "m2" },
        m2: { type: "message", text: "Winner is announced on [date] in our stories. Good luck!", delay_seconds: 3, next: null },
      },
    },
    tips: ["Check the giveaway rules on Instagram's promotion guidelines before you run one.", "Export entrants with the tag from the Contacts page."],
    faq: [["Can it pick the winner?", "Not in this flow. You can export everyone tagged as an entrant and pick randomly with our free giveaway picker."], ...COMMON_FAQ],
  },
  {
    slug: "welcome-new-follower-dm",
    name: "Welcome and menu",
    h1: "Instagram welcome DM with a quick menu",
    intro: "Greet anyone who messages you and let them choose what they need, so you answer the same questions less often.",
    trigger: "Someone sends HI or any first message",
    sampleReplies: ["hours"],
    graph: {
      startNodeId: "m1",
      nodes: {
        m1: { type: "message", text: "Hi, welcome! Reply ORDER, HOURS or HELP and I will point you the right way.", next: "c1" },
        c1: { type: "condition", branches: [{ keyword: "order", next: "m2" }, { keyword: "hours", next: "m3" }, { keyword: "help", next: "t1" }], default_next: "m4" },
        m2: { type: "message", text: "You can order here: [your link]", next: null },
        m3: { type: "message", text: "We are open [your hours].", next: null },
        t1: { type: "tag", tag: "needs-human", next: "m5" },
        m5: { type: "message", text: "Thanks! A real person will reply soon.", next: null },
        m4: { type: "message", text: "Reply ORDER, HOURS or HELP.", next: "c1" },
      },
    },
    tips: ["Tag HELP requests so you can find the chats that need a person."],
    faq: [...COMMON_FAQ],
  },
]

export const templateBySlug = (slug: string) => FLOW_TEMPLATES.find((t) => t.slug === slug)
