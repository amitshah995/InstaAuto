import type { BlogPost } from "./types"

export const POSTS_D: BlogPost[] = [
  {
    slug: "follow-gate-pros-and-cons",
    title: "Follow-gates: the pros, the cons and a fairer alternative",
    excerpt: "Asking people to follow you before they get the link can raise follower numbers. It can also annoy the very people you want. A balanced look.",
    category: "Growth",
    date: "2026-10-16",
    readMinutes: 6,
    tldr: [
      "A follow-gate asks a commenter to follow your account before receiving what they asked for.",
      "It can help growth, but it adds friction and can feel like a toll. Use it only when the reward is clearly worth it.",
      "A softer option is to deliver first and invite them to follow afterwards.",
    ],
    sections: [
      {
        heading: "What a follow-gate is",
        blocks: [
          { t: "p", text: "A follow-gate is a rule in your flow that says: before I send the link, please follow my account. The viewer comments the keyword, receives a message asking them to follow, and only gets the real reward after they confirm." },
          { t: "p", text: "Whether it is a good idea depends on your goal, your audience and how valuable the reward really is. There is no single right answer, so here are both sides." },
        ],
      },
      {
        heading: "The case for a follow-gate",
        blocks: [
          { t: "ul", items: [
            "It turns a one-off visitor into someone who will see your next post.",
            "It filters for people who care a little more than average.",
            "For a creator whose business is the audience itself, followers are the product.",
            "It can make a free resource feel more valuable, because the exchange is explicit.",
          ] },
          { t: "p", text: "If you give away something substantial, such as a full template pack or a detailed guide, a follow is a fair trade for many people." },
        ],
      },
      {
        heading: "The case against",
        blocks: [
          { t: "ul", items: [
            "Every extra step loses some people. Some will leave when they hit the gate.",
            "It can feel like a trap, especially if the reel did not mention it.",
            "A follow given to unlock a link is not the same as a follower who wants your content. Some will unfollow soon after.",
            "For a seller with a time-sensitive question, such as price, it delays the thing they came for.",
            "Checking whether someone followed may rely on features the official API limits. Be clear about what your tool can and cannot verify.",
          ] },
          { t: "callout", kind: "warn", title: "Watch out", text: "Do not word the gate as if the link will not work without a follow, unless that is true in your setup. Misleading wording damages trust more than a lower follower count would." },
        ],
      },
      {
        heading: "When it tends to make sense",
        blocks: [
          { t: "ul", items: [
            "You are a creator or teacher and the free resource is substantial.",
            "The audience, not the sale, is your main goal this month.",
            "The reel says clearly that following is part of the deal.",
          ] },
          { t: "h3", text: "When to skip it" },
          { t: "ul", items: [
            "You sell products and the person asked a price or size question.",
            "Your offer is urgent, such as a limited seat or a stock drop.",
            "You are testing a new reel and want clean data on interest.",
          ] },
        ],
      },
      {
        heading: "A fairer alternative: deliver first, then invite",
        blocks: [
          { t: "p", text: "You can keep the benefits of asking without the toll. Send what you promised in the first message, and then, a little later in the chat, ask politely." },
          { t: "dm-example", comment: "GUIDE", messages: [
            "Here is your free guide: example.com/guide",
            "If it helps, I share a new tip every week. You can follow along here whenever you like. What are you hoping to learn first?",
          ], caption: "The gift arrives first. The invite is optional.", handle: "leo.w" },
          { t: "p", text: "People who follow after getting value tend to follow because they want more, and that is the audience you want." },
        ],
      },
      {
        heading: "How the audience sees it",
        blocks: [
          { t: "p", text: "Think about it from the viewer’s side. They found a reel they liked and asked for something. Now they are asked to do a task before they get it. For some, that is a fair deal. For others, it breaks the flow of the moment." },
          { t: "p", text: "Their feeling depends a lot on trust. If they already know your work, a follow is almost free. If they met you ten seconds ago, a follow is a bigger request. This is why follow-gates tend to work better for accounts that already have a loyal audience." },
        ],
      },
      {
        heading: "Things that go wrong with gates",
        blocks: [
          { t: "ul", items: [
            "The gate message is longer than the reward message.",
            "The reel never mentioned following, so the request feels like a surprise.",
            "Followers are checked inconsistently, so some people are blocked by mistake.",
            "No one reads the replies from people who are confused.",
          ] },
          { t: "p", text: "If you notice complaints, pause the gate and review the wording. A short, kind, honest message solves most of these problems." },
        ],
      },
      {
        heading: "How to test it fairly",
        blocks: [
          { t: "p", text: "Do not rely on a feeling. Run both versions on similar reels, one after the other, and compare what happens. Avoid drawing conclusions from one reel, since reels vary a lot in reach." },
          { t: "ol", items: [
            "Pick two reels with a similar topic and a similar offer.",
            "Use a follow-gate on one and deliver-first on the other.",
            "Write down comments, replies and link clicks for each.",
            "Look at the numbers a week later, along with how many people unfollowed.",
            "Ask a few people in the chat what they thought.",
          ] },
          { t: "callout", kind: "tip", title: "Pro tip", text: "Judge by the whole path, from comment to the thing you actually want, such as a sale or a booked call, not only the follower count." },
        ],
      },
      {
        heading: "What about people who do not follow?",
        blocks: [
          { t: "p", text: "If you do use a gate, plan for the person who does not follow. Some will simply not want to. Others will follow, but your tool will not be able to confirm it. Decide beforehand how you want to treat both groups." },
          { t: "ul", items: [
            "Give a clear message that explains what is missing, in a friendly tone.",
            "Offer a second route, such as a smaller version of the reward, so no one leaves with nothing.",
            "Do not repeat the request many times. One reminder is enough.",
          ] },
          { t: "p", text: "A gate that lets people say no gracefully costs you fewer fans than one that nags." },
        ],
      },
      {
        heading: "Decision checklist",
        blocks: [
          { t: "checklist", title: "Before you add a follow-gate", items: [
            "The reward is worth a follow in the viewer’s eyes.",
            "The reel states the condition up front.",
            "Your wording is honest about what happens.",
            "You know what your tool can verify.",
            "You will compare it with a deliver-first version.",
          ] },
        ],
      },
    ],
  },

  {
    slug: "reading-your-funnel-comments-to-dms-to-clicks",
    title: "Reading your funnel: comments, DMs and clicks without made-up benchmarks",
    excerpt: "How to read the three numbers that matter, what each drop-off is telling you, and why comparing yourself with your own last month beats any industry average.",
    category: "Growth",
    date: "2026-11-06",
    readMinutes: 7,
    tldr: [
      "Your funnel has three steps: comments with the keyword, messages sent and replied to, and link clicks.",
      "Each drop-off points to a different fix: the reel, the first message, or the link.",
      "Compare against your own history. Outside benchmarks depend on topics and audiences that differ from yours.",
    ],
    sections: [
      {
        heading: "The funnel in plain words",
        blocks: [
          { t: "p", text: "A comment-to-DM funnel is a short path. A viewer comments, you send a message, they reply or click, and ideally they do the thing you wanted, such as buy or book." },
          { t: "p", text: "You do not need a complicated dashboard to read it. Three counts are enough, and each answers a different question." },
          { t: "ol", items: [
            "Keyword comments: did the reel make people want the offer?",
            "Messages delivered and replied to: did the first message feel useful?",
            "Link clicks: did the message make the next step clear?",
          ] },
        ],
      },
      {
        heading: "Why we do not quote benchmarks",
        blocks: [
          { t: "p", text: "You will find articles that say a “good” reply rate is some exact percentage. Be wary. Accounts differ in topic, price, country, audience size and how they ask. A number that is average for one business is poor for another." },
          { t: "p", text: "A fairer comparison is you against you. Is this reel doing better than your last three? Did the new first message beat the old one? That is information you can act on." },
        ],
      },
      {
        heading: "Step 1: comments tell you about the reel",
        blocks: [
          { t: "p", text: "Look at how many people typed the keyword compared with how many people watched. If views are healthy but keyword comments are few, the reel is not asking clearly." },
          { t: "ul", items: [
            "Was the keyword said out loud, and shown on screen?",
            "Did the reel make the benefit clear before the ask?",
            "Was the ask near the end, where only some viewers arrive?",
          ] },
          { t: "p", text: "Try moving the ask earlier, or repeating it. Change one thing per reel so you know what worked." },
        ],
      },
      {
        heading: "Step 2: replies tell you about the first message",
        blocks: [
          { t: "p", text: "Delivered messages with few replies usually mean the message answered the question but gave no reason to continue. That is not always bad. For a price list, a click may be all you want." },
          { t: "p", text: "If you wanted a conversation, look at your closing line. A question that takes one word to answer will almost always do better than a general invitation." },
          { t: "callout", kind: "tip", title: "Pro tip", text: "Read ten real replies each week. Numbers tell you what happened. People’s words tell you why." },
        ],
      },
      {
        heading: "Replies versus clicks: which one do you want?",
        blocks: [
          { t: "p", text: "Not every automation needs a conversation. A price list or a menu can do its job with a single tap. A coaching offer or a custom order needs back and forth. Decide which one you are building, because it changes how you read the numbers." },
          { t: "ul", items: [
            "For link-first offers, clicks matter most and replies are a bonus.",
            "For conversation-first offers, replies matter most and clicks are a bonus.",
            "For mixed offers, watch both, and look at which one leads to more sales for you.",
          ] },
          { t: "p", text: "Writing this decision at the top of your log keeps you from judging a link-first flow by its reply count, or the other way round." },
        ],
      },
      {
        heading: "Step 3: clicks tell you about the link",
        blocks: [
          { t: "p", text: "Few clicks after many deliveries can point to three things: the link was hidden in the text, the page loads slowly on a phone, or the message did not say what the link gives them." },
          { t: "ul", items: [
            "Put the link on its own line.",
            "Say what they will see: “Full price list” beats a bare address.",
            "Open the link on a mobile connection and see how it feels.",
          ] },
        ],
      },
      {
        heading: "What a drop-off is telling you",
        blocks: [
          { t: "dm-example", comment: "PRICE", messages: [
            "Hi! The price list is here: example.com/prices",
            "Anything specific you are looking for? I can point you to the right one.",
          ], caption: "Two things to measure here: the reply and the click.", handle: "demo_user" },
          { t: "ul", items: [
            "Many comments, few deliveries: check that the rule matches and that the comment was recent enough to reply to.",
            "Many deliveries, few replies: improve the ending question.",
            "Many replies, few sales: look at your human follow-up and your price.",
            "Many clicks, few sales: the problem is the page, not the message.",
          ] },
          { t: "callout", kind: "warn", title: "Watch out", text: "Small numbers jump around. Ten comments on one reel and twenty on the next is not a trend. Wait for a few weeks of data before changing strategy." },
        ],
      },
      {
        heading: "A worked example, in words",
        blocks: [
          { t: "p", text: "Say a candle seller posts a reel and asks viewers to comment the word GLOW. Over the week, she writes down what she sees: how many comments used the keyword, how many messages went out, how many people replied, and how many opened the link." },
          { t: "p", text: "Next week she changes only the closing line of the first message, from “Hope you love it” to “Which scent would you like to try first?” Everything else stays the same, including the reel style. When she compares the two weeks, any change in replies is much more likely to come from that one edit." },
          { t: "p", text: "That is the whole method. Change one thing, wait, compare with yourself, write it down. It is slower than copying a trick from a video, but it teaches you what your own audience responds to." },
          { t: "h3", text: "Keep a simple log" },
          { t: "p", text: "A spreadsheet with one row per reel is enough. Add columns for the date, the keyword, the offer, the four counts and a short note about what you changed. After two months you will have a record that no outside report can match." },
        ],
      },
      {
        heading: "A weekly ten-minute review",
        blocks: [
          { t: "checklist", title: "Weekly funnel review", items: [
            "Write down comments, delivered, replies and clicks for each reel.",
            "Compare with your own previous weeks, not with other accounts.",
            "Change one thing: the ask, the first message or the link.",
            "Read ten replies in full.",
            "Note what you changed so you can judge it next week.",
          ] },
        ],
      },
      {
        heading: "Frequently asked questions",
        blocks: [
          { t: "faq", items: [
            { q: "What is a good reply rate?", a: "There is no number that fits every account. Track your own and aim to beat it." },
            { q: "Why do clicks differ from page visits in my analytics?", a: "Different tools count differently, and some people open links in other apps. Use one source consistently." },
          ] },
        ],
      },
    ],
  },
]
