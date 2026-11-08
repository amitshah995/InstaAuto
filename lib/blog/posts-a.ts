import type { BlogPost } from "./types"

export const POSTS_A: BlogPost[] = [
  {
    slug: "how-comment-to-dm-automation-works",
    title: "How comment-to-DM automation works, step by step",
    excerpt: "Someone comments a word under your reel and a message lands in their inbox. Here is what happens in between, and what you control at each step.",
    category: "Product",
    date: "2026-11-04",
    readMinutes: 6,
    featured: true,
    tldr: [
      "A viewer comments a keyword, your automation spots it, and Instagram delivers one private reply to that person.",
      "The first message is a reply to a comment, so it is allowed once per comment and only while the comment is recent.",
      "Everything after the first message happens only if the person answers, which keeps the chat welcome and low pressure.",
    ],
    sections: [
      {
        heading: "The short version",
        blocks: [
          { t: "p", text: "You post a reel and say “Comment PRICE and I will send you the list.” A viewer types PRICE. A few seconds later a message from your account appears in their inbox with the list. No one on your team typed anything." },
          { t: "p", text: "That is comment-to-DM automation. It is a small piece of software that watches the comments on the posts you choose, checks them against rules you wrote, and sends the reply you prepared. It does not guess, and it does not invent new messages. It does what you set up, at the speed of a computer." },
          { t: "p", text: "This guide walks through each step so you know what is happening under the hood. That makes it much easier to write good rules and to fix them when something does not fire." },
        ],
      },
      {
        heading: "The five moving parts",
        blocks: [
          { t: "p", text: "Every comment-to-DM setup, in any tool, is built from the same five parts." },
          { t: "ol", items: [
            "Trigger: a new comment on a post, reel or live that you have connected to the automation.",
            "Match: a check of the comment text against your keyword rules.",
            "First message: the private reply sent to the person who commented.",
            "Follow-up: optional messages that continue only after the person answers.",
            "Record: the contact, the tags and the clicks saved so you can see what worked.",
          ] },
          { t: "p", text: "If an automation misbehaves, one of these five is almost always the cause. A comment that never matched is a match problem. A person who got the message but never replied is a first-message problem. Treat them as separate things to fix." },
        ],
      },
      {
        heading: "What happens, step by step",
        blocks: [
          { t: "h3", text: "1. The comment arrives" },
          { t: "p", text: "When you connect your professional account through Instagram’s own login, you allow the tool to receive comment notifications for that account. When a viewer comments, Instagram tells the tool about it. The tool never needs your password." },
          { t: "h3", text: "2. The rule is checked" },
          { t: "p", text: "The tool compares the comment with the keywords on that post. You can choose whether the comment must contain the keyword, or equal it exactly. Most people pick “contains” and ignore capital letters, so “price”, “PRICE” and “Price please” all count." },
          { t: "h3", text: "3. A private reply is sent" },
          { t: "p", text: "If the rule matches, the tool asks Instagram to send a private reply tied to that specific comment. This is a different kind of message from a normal DM. It is the one route that lets a business start a conversation with someone who has only commented, and it is built for exactly this use." },
          { t: "dm-example", comment: "PRICE", messages: [
            "Hi Maya, thanks for asking! Here is the full price list: example.com/prices",
            "Want me to help you pick? Reply with what you are looking for and I will point you to the right one.",
          ], caption: "A comment on a reel, and the private reply that follows.", handle: "maya_k" },
          { t: "h3", text: "4. The person decides what happens next" },
          { t: "p", text: "From here the viewer can ignore the message, tap the link, or write back. If they write back, a new door opens: you can keep chatting, either through a prepared flow or by hand from your inbox. If they do not, you stop. That is a good thing. It means every extra message was asked for." },
        ],
      },
      {
        heading: "Why the first message is a private reply",
        blocks: [
          { t: "p", text: "Instagram lets a business reply privately to a comment, but with limits. At the time of writing, you can send one private reply per comment, and it has to be sent within a limited number of days after the comment. After that, you can only send more messages once the person has answered you." },
          { t: "p", text: "These limits shape how you write. Your first message has to do real work on its own, because you only get one. It should deliver what you promised, say who it is from, and make the next step obvious." },
          { t: "callout", kind: "warn", title: "Rules can change", text: "The exact time windows and limits are set by Instagram and can change. Check Meta’s current developer documentation before you rely on a specific number, and prefer tools that follow the official API so they update with it." },
        ],
      },
      {
        heading: "Writing rules that match well",
        blocks: [
          { t: "p", text: "Most failed automations fail at the match step. A few habits help." },
          { t: "ul", items: [
            "Pick one short, easy word. People type on phones, so avoid words that autocorrect changes.",
            "Say the word out loud in the reel and write it in the caption, so it is not a surprise.",
            "Use a different keyword for each post, so you know which post brought which person.",
            "Accept small variations. Allow plural forms and common typos if your tool lets you.",
            "Do not reuse the same keyword for two offers on the same account.",
          ] },
          { t: "callout", kind: "tip", title: "Pro tip", text: "Test with a second account before you post. Comment the keyword and read the message exactly as a customer sees it, including on a small phone screen." },
        ],
      },
      {
        heading: "Replying to the comment itself",
        blocks: [
          { t: "p", text: "Many setups also post a short public reply under the comment, such as “Sent! Check your DMs.” This helps because people sometimes wonder whether anything happened. It also keeps the comment thread looking active." },
          { t: "p", text: "Vary the wording. If fifty comments all get the same public line, the thread looks mechanical. Write three or four versions and rotate them." },
        ],
      },
      {
        heading: "Tone matters as much as speed",
        blocks: [
          { t: "p", text: "Speed is the main benefit of automation, but speed alone is not the goal. A reply that arrives in seconds and sounds cold will be read and forgotten. A reply that arrives in seconds and sounds like you will be remembered." },
          { t: "p", text: "That is why we suggest writing the first message in your own voice, reading it out loud, and sending a few test comments to yourself before the post goes live. It takes ten minutes and saves you from awkward surprises." },
        ],
      },
      {
        heading: "What automation cannot do",
        blocks: [
          { t: "ul", items: [
            "It cannot message people who did not comment, unless they messaged you first.",
            "It cannot send unlimited follow-ups to someone who has gone quiet.",
            "It cannot fix a weak offer. A fast reply to a vague promise is still a vague promise.",
            "It cannot replace a person for complicated questions. Plan a clear hand-over to your inbox.",
          ] },
          { t: "p", text: "Think of it as a very fast assistant who is good at one job: answering the same question quickly, every time." },
        ],
      },
      {
        heading: "Your first setup, in order",
        blocks: [
          { t: "checklist", title: "Before you switch it on", items: [
            "Pick one post and one offer.",
            "Choose a keyword and say it in the reel.",
            "Write the first message so it works even if no one replies.",
            "Add a public reply under the comment.",
            "Test it from a second account.",
            "Check your inbox the next morning and answer anyone who replied.",
          ] },
        ],
      },
      {
        heading: "Frequently asked questions",
        blocks: [
          { t: "faq", items: [
            { q: "Does it work on reels, posts and live videos?", a: "Comment-based triggers are available for the content types the official API supports. Your tool will show which posts you can connect." },
            { q: "Do I need a business account?", a: "You need a professional account (Business or Creator) connected through Instagram’s official login." },
            { q: "Will people know it is automatic?", a: "Many will guess. It is fine to be open about it. A friendly, useful message matters more than hiding how it was sent." },
          ] },
        ],
      },
    ],
  },

  {
    slug: "reel-comment-keywords-by-business-type",
    title: "12 keyword ideas for reel comments, by business type",
    excerpt: "A good keyword is short, easy to type and tied to one clear offer. Here are twelve you can adapt, grouped by the kind of business you run.",
    category: "Templates",
    date: "2026-10-14",
    readMinutes: 6,
    tldr: [
      "Pick a keyword that is one word, easy to spell on a phone and obviously linked to what you promised.",
      "Match the keyword to the offer in the reel, and use a different one for each reel.",
      "The twelve ideas below are starting points. Change the wording to sound like you.",
    ],
    sections: [
      {
        heading: "What makes a good keyword",
        blocks: [
          { t: "p", text: "The keyword is the smallest part of your reel and one of the most important. If it is hard to type, people skip it. If it is vague, they do not know what they will get." },
          { t: "p", text: "Use these four checks before you commit to a word." },
          { t: "ul", items: [
            "One word, no spaces. Fewer ways to get it wrong.",
            "Five letters or fewer is ideal, because it is quick on a phone.",
            "It names the thing. “MENU” says more than “YES”.",
            "It is unlikely to appear in normal chatter. A comment that says “price” by accident is fine. One that says “love” will trigger on every compliment.",
          ] },
          { t: "callout", kind: "tip", title: "Pro tip", text: "Say the keyword out loud twice in the reel and show it on screen. Then write it in capitals in the caption. People act on what they hear and see, not on what they might have read." },
        ],
      },
      {
        heading: "For sellers and online shops",
        blocks: [
          { t: "p", text: "Sellers get the same questions again and again: how much, what sizes, how do I order. Each question can have its own word." },
          { t: "ol", items: [
            "PRICE: sends the price list or the price of the item in the reel.",
            "SIZE: sends the size guide and asks which size they usually wear.",
            "LINK: sends the direct product link. Good for launches and restocks.",
          ] },
          { t: "p", text: "Do not use all three on the same reel. One reel, one question. If your reel shows a jacket, use SIZE or PRICE, not both." },
        ],
      },
      {
        heading: "For salons, studios and clinics",
        blocks: [
          { t: "p", text: "Local businesses want one outcome: a booking. The keyword should lead toward it, and the first message should offer a clear next step." },
          { t: "ol", items: [
            "BOOK: sends the booking link and your next free days.",
            "MENU: sends the service list with prices and durations.",
            "OFFER: sends the current seasonal deal and when it ends.",
          ] },
          { t: "dm-example", comment: "BOOK", messages: [
            "Hi! Thanks for your interest. Here is our booking page: example.com/book",
            "Prefer to ask first? Tell me which service you want and I will check what is free this week.",
          ], caption: "A booking keyword on a salon reel.", handle: "nina.studio" },
        ],
      },
      {
        heading: "For coaches, teachers and course creators",
        blocks: [
          { t: "p", text: "Here the keyword is often a promise of something free that shows how you teach. The message that follows can ask one question to understand the person before offering a call." },
          { t: "ol", items: [
            "GUIDE: sends a free PDF, checklist or short lesson.",
            "CALL: starts a short chat that ends with a booking link.",
            "START: sends the first lesson, then asks what they want to learn.",
          ] },
          { t: "p", text: "Keep the free thing honestly free. If a person has to fill in a long form to get it, the keyword was a trick, and people remember." },
        ],
      },
      {
        heading: "For food, events and local venues",
        blocks: [
          { t: "ol", items: [
            "TABLE: starts a reservation request for the day and size of party.",
            "MENU: sends the menu and opening hours.",
            "TICKET: sends the ticket link or the guest list form for an event.",
          ] },
          { t: "p", text: "Restaurants often forget the simplest message: opening hours and a map link. That alone answers a large share of questions." },
        ],
      },
      {
        heading: "Mixing and rotating keywords",
        blocks: [
          { t: "p", text: "You can run several keywords on one account at the same time, as long as each belongs to a different post. Keep a simple sheet with three columns: reel, keyword, offer. Without it, you will forget which word belongs to which reel by next month." },
          { t: "h3", text: "Retire keywords when the offer ends" },
          { t: "p", text: "People find old reels. If the offer is over, switch the automation to a message that says so and points to what is current. A reply about a sale that ended last month does more harm than no reply." },
          { t: "callout", kind: "warn", title: "Watch out", text: "Avoid keywords that look like spam to a stranger, such as “FREE” in capitals with exclamation marks. They invite suspicion and are easy to mistype in a hurry. A calm, specific word works better." },
        ],
      },
      {
        heading: "Seasonal and one-off keywords",
        blocks: [
          { t: "p", text: "Some keywords are only for a moment: a festival sale, a launch week, an event. Use a word that names the occasion, like DIWALI or LAUNCH, and set a date to switch it off. Add the end date to your tracking sheet the day you create the keyword." },
          { t: "p", text: "When the moment passes, do not just delete the rule. Point it to a short message that explains the offer is over and shares what is current. That way, people who find the reel later still get a useful answer." },
        ],
      },
      {
        heading: "Writing the matching rule",
        blocks: [
          { t: "p", text: "Choosing the word is half the job. The other half is telling your tool how to match it. Two settings are worth understanding." },
          { t: "ul", items: [
            "Contains: any comment that includes the word counts. “Price please” and “what is the price?” both match PRICE.",
            "Exact: only a comment that is the word and nothing else counts. This is stricter, and good when the word is short and common.",
          ] },
          { t: "p", text: "For most reels, “contains” with capitals ignored is the friendliest choice. People type naturally, and you do not lose them over a full stop or an extra word." },
          { t: "h3", text: "Allow for typos" },
          { t: "p", text: "If your tool lets you list several spellings for the same rule, add the two or three most likely mistakes. For BOOK, you might add BOOKING. For MENU, perhaps MENUE. This costs nothing and rescues a handful of comments every month." },
        ],
      },
      {
        heading: "Pick your word",
        blocks: [
          { t: "checklist", title: "Keyword checklist", items: [
            "One word, easy to spell.",
            "Tied to one offer in this reel.",
            "Said out loud and shown on screen.",
            "Not a word people use in everyday comments.",
            "Written in your tracking sheet.",
            "Has an end date or a review date.",
          ] },
        ],
      },
      {
        heading: "Frequently asked questions",
        blocks: [
          { t: "faq", items: [
            { q: "Should the keyword be in capitals?", a: "In your caption and on screen, yes, because it stands out. In matching, ignore capitals so people can type however they like." },
            { q: "Can I use words in my own language?", a: "Yes. Use the word your audience actually types. Just make sure it is easy to spell on a phone keyboard." },
            { q: "What if two people comment the same word?", a: "Each comment gets its own private reply. The rule is applied per comment, not per post." },
          ] },
        ],
      },
    ],
  },
]
