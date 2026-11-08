import type { BlogPost } from "./types"

export const POSTS_E: BlogPost[] = [
  {
    slug: "story-reply-automation-ideas",
    title: "Story reply automation ideas that feel personal",
    excerpt: "Stories get quick, casual replies. Here are seven ways to answer them automatically without sounding like a machine.",
    category: "Templates",
    date: "2026-10-23",
    readMinutes: 6,
    tldr: [
      "Story replies arrive as normal messages, so the conversation window is already open.",
      "Match the reply to the sticker or question in the story. Generic thanks feel hollow.",
      "Keep each automated reply short and always leave an easy way to talk to a person.",
    ],
    sections: [
      {
        heading: "Why stories are different",
        blocks: [
          { t: "p", text: "A reel brings strangers. A story reaches people who already follow you. When someone replies to a story, they have started a message thread themselves, which opens the messaging window and makes the conversation feel personal." },
          { t: "p", text: "That is a good place for automation, as long as the replies match the mood. Casual, short and specific works. A paragraph of marketing does not." },
          { t: "callout", kind: "warn", title: "Check what your tool supports", text: "The features available for stories depend on what the official API supports at the time. Confirm what your tool can do before you design a flow around it." },
        ],
      },
      {
        heading: "Idea 1: the poll follow-up",
        blocks: [
          { t: "p", text: "Run a story asking “Which colour next?” and reply to each answer with a related message. Someone who picked blue gets a note about the blue option and when it arrives." },
          { t: "p", text: "It shows you listened, and it gives you a free list of interested people." },
        ],
      },
      {
        heading: "Idea 2: the question box",
        blocks: [
          { t: "p", text: "Use a question sticker, such as “Ask me anything about skincare”. Common questions get a short answer plus a link to a fuller one." },
          { t: "dm-example", comment: "Story reply: “Is this good for dry skin?”", messages: [
            "Great question! Our cream is made for dry skin. Here is the full ingredient list: example.com/cream",
            "Want me to send a few tips on how to use it?",
          ], caption: "A story reply with a quick, specific answer.", handle: "tara_b" },
        ],
      },
      {
        heading: "Idea 3: the keyword story",
        blocks: [
          { t: "p", text: "Ask viewers to reply to the story with a word, in the same way you would on a reel. This works well for limited offers because stories vanish after a day, which gives the offer a natural end." },
        ],
      },
      {
        heading: "Idea 4: the behind-the-scenes thank-you",
        blocks: [
          { t: "p", text: "If someone reacts with an emoji to a behind-the-scenes story, send a short thanks and a question: “Glad you liked it! Want to see how we pack the orders?” It keeps the relationship friendly with almost no effort." },
        ],
      },
      {
        heading: "Idea 5: the waiting list",
        blocks: [
          { t: "p", text: "Tease a launch in a story. Anyone who replies with “LIST” gets added to your waiting list and receives a message when it is ready. Say clearly that this is what will happen, and give a way to leave the list." },
        ],
      },
      {
        heading: "Idea 6: the event reminder",
        blocks: [
          { t: "p", text: "Post a story about a workshop, a sale day or a class. People who reply “REMIND” get a message with details. Remember that the messaging window is limited, so send details immediately and keep any later reminder inside the allowed time." },
        ],
      },
      {
        heading: "Idea 7: close the loop on polls",
        blocks: [
          { t: "p", text: "After you close a poll, send people a short update: “You voted for the green one, and it is coming on Friday.” Closing the loop makes your audience feel heard, and it takes no extra effort once it is set up." },
        ],
      },
      {
        heading: "Idea 8: the “talk to a human” door",
        blocks: [
          { t: "p", text: "Every automated story flow should have an exit. Add a line such as “Prefer to talk to a person? Reply HELP.” and make sure someone reads those." },
        ],
      },
      {
        heading: "How replies to stories differ from comments",
        blocks: [
          { t: "p", text: "With a reel comment, the person is public. Others can see the word they typed, and the thread becomes part of the post. A story reply is private from the start. That changes the tone you should use." },
          { t: "ul", items: [
            "Be warmer and shorter. It is a chat between two people, not a public announcement.",
            "Do not repeat the offer in a long block. They saw the story a minute ago.",
            "Respect the one-to-one feel. Avoid sending the same text you used under a reel.",
          ] },
          { t: "h3", text: "Timing and expiry" },
          { t: "p", text: "Stories last a day, but replies can come late. Decide what should happen to a reply that arrives after an offer has ended. A good fallback says the offer is over, points to what is current, and asks if they would like to hear about the next one." },
          { t: "h3", text: "A simple rule for tone" },
          { t: "p", text: "Before you save a story flow, read it as if a close friend had sent it to you. If it sounds strange coming from a friend, it will sound strange coming from you." },
          { t: "p", text: "It also helps to write three versions of each reply and rotate them. People who reply to several stories in a week will notice if every answer is identical, and rotating wording is an easy fix." },
          { t: "h3", text: "When not to automate" },
          { t: "p", text: "Some replies deserve a human right away: someone sharing personal news, a complaint, a message that sounds upset. Make sure your flow does not answer those with a cheerful template. If your tool lets you pause automation when certain words appear, use that. If not, check story replies by hand each morning." },
        ],
      },
      {
        heading: "Keeping it personal",
        blocks: [
          { t: "ul", items: [
            "Refer to the specific story: “Thanks for the reply on today’s shoot!”",
            "Vary the wording across a few versions.",
            "Use plain language and the voice you use on camera.",
            "Skip long links. One clean link at most.",
          ] },
          { t: "callout", kind: "tip", title: "Pro tip", text: "Write the reply as if you were answering a friend on your phone between meetings. Then trim it by a third." },
        ],
      },
      {
        heading: "Measuring what works",
        blocks: [
          { t: "p", text: "Story flows are easy to forget once they are running. Put a reminder in your calendar to check them every two weeks. Look at how many people replied, how many conversations continued, and whether anyone asked for a human." },
          { t: "p", text: "Keep notes on which story types led to more conversation. Over time you will learn whether your audience prefers polls, questions or keyword offers, and you can plan more of those." },
        ],
      },
      {
        heading: "Story flow checklist",
        blocks: [
          { t: "checklist", title: "Before the story goes live", items: [
            "Reply matches the sticker or question.",
            "Offer ends when the story ends, or says otherwise.",
            "There is a way to reach a person.",
            "There is a way to stop messages.",
            "You tested it by replying from another account.",
          ] },
        ],
      },
    ],
  },

  {
    slug: "free-instagram-audit-checklist",
    title: "A free Instagram audit checklist you can finish in 30 minutes",
    excerpt: "Check your profile, your content and your comment-to-DM path with twenty simple questions. No tools needed, just a notebook and your phone.",
    category: "Growth",
    date: "2026-10-10",
    readMinutes: 7,
    tldr: [
      "An audit is a short, honest look at your profile, content and the path from comment to conversation.",
      "Score yourself yes or no. The no answers are your to-do list.",
      "Fix two or three things per week instead of everything at once.",
    ],
    sections: [
      {
        heading: "What an audit is for",
        blocks: [
          { t: "p", text: "Before you automate anything, it helps to know what you are automating. An audit is a calm look at where you are today: what a stranger sees, what your content promises, and what happens when someone responds." },
          { t: "p", text: "You do not need analytics software. You need a notebook, your phone and thirty minutes. Open your own profile in a private window or from a second account, so you see it the way a new visitor does." },
        ],
      },
      {
        heading: "Part 1: your profile",
        blocks: [
          { t: "p", text: "A visitor decides in a few seconds whether you are for them. Ask these five questions." },
          { t: "ol", items: [
            "Does your name or bio say what you do in plain words?",
            "Is it clear who you help or sell to?",
            "Does your bio have one clear next step, such as a link?",
            "Does the link lead to a page that works well on a phone?",
            "Is your profile photo clear when small?",
          ] },
          { t: "callout", kind: "tip", title: "Pro tip", text: "Ask a friend who does not know your business to read your bio and tell you what you sell. If they guess wrong, rewrite it." },
        ],
      },
      {
        heading: "Part 2: your content",
        blocks: [
          { t: "p", text: "Scroll your last twelve posts as a visitor would." },
          { t: "ol", items: [
            "Can you tell what the account is about from the grid alone?",
            "Do your reels start with a clear hook in the first seconds?",
            "Do they make one point each?",
            "Do they end with a specific ask?",
            "Do you reply to comments within a day?",
          ] },
          { t: "p", text: "Make a note of which reels got the most conversation, not just the most views. Conversations are closer to customers." },
        ],
      },
      {
        heading: "Part 3: the comment-to-DM path",
        blocks: [
          { t: "p", text: "This is where automation helps. Walk the path yourself." },
          { t: "ol", items: [
            "Do your reels offer something people can ask for, such as a price, a guide or a booking?",
            "Is there a clear keyword, said out loud and shown on screen?",
            "Does the first message deliver what was promised?",
            "Does it end with a question that invites a reply?",
            "Is there a person who reads and answers the replies?",
          ] },
          { t: "dm-example", comment: "GUIDE", messages: [
            "Thanks for asking! Here is the guide: example.com/guide",
            "Which part would you like help with first?",
          ], caption: "What a good answer to question 3 and 4 looks like.", handle: "audit_demo" },
        ],
      },
      {
        heading: "Part 4: trust and safety",
        blocks: [
          { t: "ol", items: [
            "Is your account a professional account?",
            "Do you use only tools that connect through Instagram’s official login?",
            "Can people opt out of your messages easily?",
            "Do you avoid fake urgency or claims you cannot prove?",
            "Is there a privacy page where you collect details?",
          ] },
          { t: "callout", kind: "warn", title: "Watch out", text: "If any tool asks for your Instagram password, stop and remove its access. Official tools use a login screen from Instagram itself." },
        ],
      },
      {
        heading: "Part 5: the human side",
        blocks: [
          { t: "p", text: "Automation handles the first reply. People handle everything after. Be honest about whether you can keep up." },
          { t: "ol", items: [
            "Who reads the replies, and how often?",
            "How long does a customer wait for a human answer?",
            "Do you have a short script for the five most common follow-up questions?",
            "Can a teammate cover when you are away?",
          ] },
          { t: "p", text: "If the answers worry you, fix them before you add more automations. A fast first message followed by a week of silence is worse than a slower, steady reply." },
          { t: "h3", text: "A quick trial from a second account" },
          { t: "p", text: "Spend five minutes as a customer. Find one of your reels, comment the keyword and read what you get. Reply to the message and see what happens next. Notice what feels confusing, slow or too pushy. This one test often teaches more than all the questions above." },
        ],
      },
      {
        heading: "Part 6: your offer",
        blocks: [
          { t: "p", text: "The best automation cannot rescue an offer nobody wants. Be honest about whether your reels give people a reason to comment." },
          { t: "ol", items: [
            "Is the thing you give away or answer specific, such as a price list or a checklist?",
            "Would you ask for it yourself if you saw this reel?",
            "Is the next step after the first message clear?",
          ] },
          { t: "p", text: "If you answer no to the second question, change the offer before you change the tool." },
        ],
      },
      {
        heading: "Score it and pick your next three moves",
        blocks: [
          { t: "p", text: "Count the “no” answers. Do not worry about the total. Look at where they cluster. Many no answers in Part 1 mean your profile is losing visitors. Many in Part 3 mean interest is leaking after the comment." },
          { t: "p", text: "Pick the three easiest fixes with the biggest effect and do those this week. Check again in a month." },
          { t: "p", text: "It helps to write the date at the top of your notes. When you repeat the audit next month, you can see what moved, and what you only thought you had fixed. Progress is easier to keep up when you can see it." },
          { t: "ul", items: [
            "Rewrite your bio in one sentence.",
            "Add a keyword and an ask to your next reel.",
            "Write a first message that ends with a question.",
          ] },
        ],
      },
      {
        heading: "Want a second pair of eyes?",
        blocks: [
          { t: "p", text: "You can also run our free audit tool, which looks at your connected professional account and gives you a short report of things to fix. It is a starting point, not a verdict, and it works best with this checklist." },
          { t: "p", text: "[Run the free Instagram audit](/instagram-audit)" },
          { t: "checklist", title: "Your audit in one list", items: [
            "Bio says what you do and who for.",
            "One clear link that works on a phone.",
            "Reels have a hook and a specific ask.",
            "Keywords are said out loud and shown on screen.",
            "First message delivers and asks a question.",
            "A person answers replies the same day.",
            "Official login only, with a simple opt-out.",
          ] },
        ],
      },
    ],
  },
]
