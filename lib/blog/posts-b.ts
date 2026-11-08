import type { BlogPost } from "./types"

export const POSTS_B: BlogPost[] = [
  {
    slug: "write-a-first-dm-that-gets-replies",
    title: "How to write a first DM that actually gets replies",
    excerpt: "Your first automated message has one job: be useful in five seconds. Here is a simple structure, three examples and the mistakes to avoid.",
    category: "Guides",
    date: "2026-10-21",
    readMinutes: 6,
    tldr: [
      "Open with the thing they asked for, not with a greeting paragraph.",
      "Ask one small question at the end so replying takes five seconds.",
      "Read the message on a phone before you publish it. If you have to scroll, cut it.",
    ],
    sections: [
      {
        heading: "Why the first message matters so much",
        blocks: [
          { t: "p", text: "The person who commented a keyword is warm. They raised their hand a moment ago. Your first message is the moment that interest either turns into a conversation or fades away." },
          { t: "p", text: "Because you only get one private reply per comment, you cannot send a second message to “try again”. The first one has to work. That sounds stressful, but it also makes the job clear: deliver the promise and make replying easy." },
        ],
      },
      {
        heading: "A four-part structure",
        blocks: [
          { t: "p", text: "Almost every good first message fits this order. You do not need to be clever. You need to be clear." },
          { t: "ol", items: [
            "Deliver: give them what the reel promised, right away.",
            "Name: say who you are in one line, so they remember why this arrived.",
            "Guide: tell them what to do with it, if it is not obvious.",
            "Ask: finish with one easy question that invites a reply.",
          ] },
          { t: "dm-example", comment: "GUIDE", messages: [
            "Hi Arjun! Here is the free starter guide: example.com/guide",
            "I am Dev from Northside Fitness, glad you asked. Which matters most to you right now, strength or fat loss? Just reply with one word.",
          ], caption: "Deliver, name, ask. Two short bubbles.", handle: "arjun.fit" },
        ],
      },
      {
        heading: "Keep it short, then shorter",
        blocks: [
          { t: "p", text: "Most people read DMs on a phone, often while doing something else. A message that fills the screen feels like homework." },
          { t: "ul", items: [
            "Aim for two or three short lines per bubble.",
            "Use one link only. Two links split attention and halve the clicks on both.",
            "Split long ideas into two bubbles instead of one block of text.",
            "Cut greetings like “I hope you are doing well”. They delay the useful part.",
          ] },
          { t: "callout", kind: "tip", title: "Pro tip", text: "Read your message out loud. If you run out of breath before the first full stop, the sentence is too long." },
        ],
      },
      {
        heading: "Use the name, carefully",
        blocks: [
          { t: "p", text: "Starting with the person’s first name makes the message feel human. Most tools can fill it in for you. The risk is when the name field is a username like “xx_cake_lover_99”, which looks odd in a greeting." },
          { t: "p", text: "A safe pattern is to use the name only when it looks like a real first name, and otherwise start with “Hi there”. If your tool cannot do that, skip the name and write a warm opening that works for everyone." },
        ],
      },
      {
        heading: "The question at the end",
        blocks: [
          { t: "p", text: "The last line decides whether you get a reply. A question that needs thinking gets ignored. A question that can be answered with a word or a tap gets answered." },
          { t: "h3", text: "Weak endings" },
          { t: "ul", items: [
            "“Let me know if you have any questions.”",
            "“Hope this helps!”",
            "“Tell me about your goals and challenges.”",
          ] },
          { t: "h3", text: "Stronger endings" },
          { t: "ul", items: [
            "“Do you want the small size or the large size?”",
            "“Is this for you or for a gift?”",
            "“Reply 1 for weekdays, 2 for weekends.”",
          ] },
          { t: "p", text: "The reply also matters for a practical reason. Once a person writes back, you are in a normal conversation and can send follow-ups. Your question is what opens that door." },
        ],
      },
      {
        heading: "Match the message to where the person came from",
        blocks: [
          { t: "p", text: "A comment under a sale reel and a comment under an educational reel come from different moods. The first person wants a price. The second wants to learn. If your first message ignores that difference, it will feel off." },
          { t: "ul", items: [
            "After a sale reel, lead with price and the link.",
            "After a how-to reel, lead with the resource and a friendly question about their goal.",
            "After a behind-the-scenes reel, keep it light and personal.",
          ] },
          { t: "p", text: "This is why one message for every reel rarely works. You do not need dozens of versions. Two or three, matched to the kind of content, is enough." },
        ],
      },
      {
        heading: "Mistakes that cost replies",
        blocks: [
          { t: "ul", items: [
            "Hiding the promised thing behind another step. If the reel said “comment for the price”, the price belongs in the first bubble.",
            "Sounding like a broadcast. Write to one person.",
            "Pitching hard. The first message should help, not sell.",
            "Forgetting to say who you are, especially if people comment on reels they found through search.",
            "Sending the same text for every reel. A reply about shoes should not mention haircuts.",
          ] },
          { t: "callout", kind: "warn", title: "Watch out", text: "Do not pretend to be a person if the message is automated and could mislead someone. A friendly tone is fine. Fake details, such as “I was just looking at your profile”, are not." },
        ],
      },
      {
        heading: "Testing two versions",
        blocks: [
          { t: "p", text: "If you are unsure between two openings, test them one after the other on similar reels. Change one line only, such as the closing question, and keep the rest the same. After a week, compare how many people replied and read a few of the replies." },
          { t: "p", text: "Do not test on the same reel at the same moment unless your tool splits people fairly. And do not decide from ten replies. Wait until you have a clear pattern, then keep the better version and try the next idea." },
        ],
      },
      {
        heading: "Three starting points you can copy",
        blocks: [
          { t: "h3", text: "For a seller" },
          { t: "p", text: "“Hi! Here is the price for the item in the reel: example.com/item. It comes in three colours. Which one do you like?”" },
          { t: "h3", text: "For a coach" },
          { t: "p", text: "“Thanks for asking! Here is the free lesson: example.com/lesson. After you watch it, what is the one thing you want help with?”" },
          { t: "h3", text: "For a local business" },
          { t: "p", text: "“Hi! Here are our opening hours and the map: example.com/visit. Would you like me to hold a table or a time for you?”" },
        ],
      },
      {
        heading: "Before you publish",
        blocks: [
          { t: "checklist", title: "First message check", items: [
            "The promised thing is in the first bubble.",
            "One link, and it opens on a phone.",
            "A short line says who you are.",
            "It ends with a question that takes five seconds to answer.",
            "You have read it on a phone screen.",
            "You know who will answer the replies, and when.",
          ] },
          { t: "p", text: "After a week, read the replies you got. The words people use are the best guide to your next version." },
        ],
      },
    ],
  },

  {
    slug: "instagram-dm-automation-rules-and-staying-safe",
    title: "Instagram DM automation rules, and how to stay on the safe side",
    excerpt: "The messaging window, the one-reply rule, opt-outs and why only the official API is worth using. A plain-English guide to automating without putting your account at risk.",
    category: "Safety",
    date: "2026-10-07",
    readMinutes: 7,
    tldr: [
      "Use only tools that connect through Instagram’s official API and its own login. Never share your password.",
      "Message people who asked for it: they commented, or they wrote to you first. Respect the messaging window.",
      "Make it easy to stop. Honour opt-outs immediately and keep your message volume sensible.",
    ],
    sections: [
      {
        heading: "Why rules matter more than tricks",
        blocks: [
          { t: "p", text: "Automation makes it easy to do the right thing quickly. It also makes it easy to do the wrong thing quickly. The difference is not the software. It is whether the messages are wanted." },
          { t: "p", text: "This guide covers the practical rules we recommend following. It is general guidance, not legal advice, and it is not a promise about how Instagram will treat any account. Platform rules change, so treat the official documentation as the final word." },
        ],
      },
      {
        heading: "Rule 1: use only the official route",
        blocks: [
          { t: "p", text: "Instagram offers a messaging API for professional accounts. Tools that use it log in through Instagram’s own screen, so you grant specific permissions and can take them back at any time." },
          { t: "p", text: "Be careful with anything that asks for your username and password, or that works by pretending to be a phone and tapping the app. Those methods go against the platform’s terms, put your account at risk, and expose your login." },
          { t: "callout", kind: "warn", title: "Watch out", text: "If a tool says it can message anyone, follow strangers in bulk or scrape followers, walk away. Those features cannot be done safely through the official API." },
        ],
      },
      {
        heading: "Rule 2: respect the messaging window",
        blocks: [
          { t: "p", text: "Instagram limits when a business can message a person. In general, you can send messages for a limited time after the person last interacted with you, commonly described as a 24-hour window. A person who comments can receive one private reply tied to that comment, within a limited number of days." },
          { t: "ul", items: [
            "A private reply starts the conversation. It is one message per comment.",
            "If the person answers, the window opens and you can continue chatting inside it.",
            "If the window closes, you wait until they message you again.",
            "Some special cases exist for human agents replying later. Read the current documentation before using them.",
          ] },
          { t: "p", text: "The exact numbers and exceptions are set by Meta and can change, so check them directly instead of relying on a blog post, including this one." },
        ],
      },
      {
        heading: "Rule 3: message people who asked",
        blocks: [
          { t: "p", text: "The healthiest automations are built on a request. The person typed your keyword. They expect something. That is the line between a helpful reply and unwanted contact." },
          { t: "ul", items: [
            "Say clearly in the reel what the comment will trigger.",
            "Send what you promised, not something different.",
            "Do not add people to unrelated promotions without asking.",
            "Do not send repeated reminders to someone who has not replied.",
          ] },
        ],
      },
      {
        heading: "Rule 4: honour opt-outs, every time",
        blocks: [
          { t: "p", text: "Anyone should be able to stop receiving messages in one step. Make it simple: end longer flows with a line such as “Reply STOP and I will not message you again.” Then do exactly that." },
          { t: "dm-example", comment: "PRICE", messages: [
            "Here is the price list: example.com/prices",
            "I may send you one reminder about our weekend offer. Reply STOP any time and I will not message you again.",
          ], caption: "A clear opt-out inside the message.", handle: "sam_r" },
          { t: "p", text: "If someone writes “stop”, “unsubscribe” or something similar in their own words, treat it as an opt-out. Mark the contact, and make sure no flow can message them again. Check this once a month. Opt-outs only work if they are tested." },
        ],
      },
      {
        heading: "Rule 5: keep volume and pace sensible",
        blocks: [
          { t: "p", text: "Platforms limit how many messages an account can send in a given period. Good tools respect those limits and queue the rest. You should also use judgement on top of that." },
          { t: "ul", items: [
            "Do not launch ten new automations on the same day. Start with one.",
            "Avoid sending the same text to hundreds of people at once through other channels.",
            "Watch your inbox for complaints or confusion after each change.",
            "Pause an automation if you notice replies like “I did not ask for this”.",
          ] },
          { t: "callout", kind: "tip", title: "Pro tip", text: "Keep a short changelog: what you switched on, when, and on which post. If something goes wrong, you will know what changed." },
        ],
      },
      {
        heading: "Rule 6: be honest in the message",
        blocks: [
          { t: "p", text: "Do not claim things that are not true. Avoid fake urgency (“only 2 left!” when that is untrue), made-up reviews or invented personal details. Besides being unfair to the reader, these can break platform and advertising rules in many places." },
          { t: "p", text: "It is also worth saying plainly who you are and what the message is for. A line of context costs you nothing." },
        ],
      },
      {
        heading: "What to do if something goes wrong",
        blocks: [
          { t: "p", text: "Even careful accounts run into trouble sometimes: a message that failed, a limit reached, a warning from the platform. Stay calm and work through it in order." },
          { t: "ol", items: [
            "Pause the automation that sent the messages in question.",
            "Read any notice from Instagram in full and note the date.",
            "Check what changed recently on your side.",
            "Fix the cause, such as the wording, the volume or the permissions.",
            "Restart slowly, with one flow, and watch the result.",
          ] },
          { t: "p", text: "Keep your own records. A short log of what ran and when makes it far easier to explain and fix a problem." },
        ],
      },
      {
        heading: "A small safety routine",
        blocks: [
          { t: "checklist", title: "Monthly safety check", items: [
            "The tool connects with Instagram’s official login.",
            "You know which permissions it has, and you removed any it does not need.",
            "Every flow mentions what it is for and how to stop.",
            "Opt-out words are tested and work.",
            "Replies and complaints are read by a person.",
            "Staff accounts have only the access they need.",
          ] },
        ],
      },
      {
        heading: "Frequently asked questions",
        blocks: [
          { t: "faq", items: [
            { q: "Can using an automation tool get my account restricted?", a: "Any account can be restricted if it breaks platform rules. Following the official route, messaging only people who asked and keeping volume reasonable lowers the risk but cannot remove it, and no one can promise a particular outcome." },
            { q: "Is Celra approved or endorsed by Meta?", a: "No. Celra is an independent product that uses Instagram’s official API. It is not affiliated with or endorsed by Meta or Instagram." },
            { q: "Where do I find the current rules?", a: "In Meta’s developer documentation for the Instagram messaging API, and in Instagram’s terms and policies for businesses." },
          ] },
        ],
      },
    ],
  },
]
