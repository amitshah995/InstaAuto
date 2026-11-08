import type { BlogPost } from "./types"

export const POSTS_C: BlogPost[] = [
  {
    slug: "price-list-and-link-dm-templates-for-sellers",
    title: "Price list and link DM templates for sellers",
    excerpt: "Five message templates for the questions every seller gets: price, sizes, stock, the order link and the follow-up. Copy them, then make them sound like you.",
    category: "Templates",
    date: "2026-10-28",
    readMinutes: 6,
    tldr: [
      "Most seller comments fall into a few repeat questions. One template per question saves hours.",
      "Give the answer first, add one link, and end with a question that helps the buyer choose.",
      "Keep prices and stock current. An old price in an automatic reply is worse than no reply.",
    ],
    sections: [
      {
        heading: "The questions you answer every day",
        blocks: [
          { t: "p", text: "Open the comments under any of your product reels and you will see the same few questions: how much, which sizes, is it in stock, how do I order. Each one takes thirty seconds to answer by hand. Multiply that by every comment on every reel, and it becomes your whole afternoon." },
          { t: "p", text: "The five templates below cover most of it. Each has a purpose, and each ends with a small question to start a real conversation. Replace the example text and links with your own." },
        ],
      },
      {
        heading: "Template 1: the price answer",
        blocks: [
          { t: "p", text: "Use for reels where the price is the main thing people ask. Keep it to the facts." },
          { t: "dm-example", comment: "PRICE", messages: [
            "Hi Sara! The linen shirt is 1,499. Free delivery on orders above 2,000.",
            "Full collection with prices: example.com/shop. Which colour were you looking at?",
          ], caption: "Price, one link, one question.", handle: "sara.m" },
          { t: "callout", kind: "tip", title: "Pro tip", text: "Write prices the way your shop writes them, with the same currency symbol. A mismatch makes buyers doubt the rest." },
        ],
      },
      {
        heading: "Before you write a single template",
        blocks: [
          { t: "p", text: "Spend ten minutes reading your last month of comments and direct messages. Copy every question into a list, then group the ones that mean the same thing. You will probably find that five or six groups cover most of what people ask." },
          { t: "p", text: "Write one template for each group, in that order of frequency. Do not try to build a reply for every possible question on day one. Start with the top three, run them for two weeks, and add more after you see what comes in." },
        ],
      },
      {
        heading: "Template 2: the size and fit guide",
        blocks: [
          { t: "p", text: "Size questions are the most common reason a sale stalls. Answer them before the person has to ask twice." },
          { t: "ul", items: [
            "Send the size chart as a link or image, not as ten lines of text.",
            "Say what size the model wears.",
            "Offer a human check: “Send me your usual size and I will tell you what to pick.”",
          ] },
          { t: "p", text: "Example: “Here is our size guide: example.com/sizes. The model wears M. What size do you usually buy?”" },
        ],
      },
      {
        heading: "Template 3: the direct order link",
        blocks: [
          { t: "p", text: "For launches, restocks and flash offers, skip the chat and send the link." },
          { t: "p", text: "Example: “Thanks for your interest! You can order here: example.com/item. Questions about delivery? Reply and I will help.”" },
          { t: "p", text: "Link to the exact product page, not the home page. Every extra tap loses people." },
        ],
      },
      {
        heading: "Template 4: the stock and delivery answer",
        blocks: [
          { t: "p", text: "People worry about two things: will it arrive, and when. Answer both in plain words." },
          { t: "ul", items: [
            "Where you ship, and the usual delivery time range.",
            "How returns work, in one sentence plus a link.",
            "What to do if an item is sold out, such as a waiting list reply keyword.",
          ] },
          { t: "callout", kind: "warn", title: "Watch out", text: "Do not promise delivery dates you cannot control. Use “usually” and a range, and keep the promise on the product page the same." },
        ],
      },
      {
        heading: "Template 5: the gentle follow-up",
        blocks: [
          { t: "p", text: "If the person replied but did not buy, one follow-up within the allowed messaging window is fair. Keep it short and give them an easy way out." },
          { t: "p", text: "Example: “Still thinking about the shirt? I can hold your size for today. Reply YES and I will set it aside, or STOP if you would like no more messages.”" },
          { t: "p", text: "Only offer to hold the item if you really will. And one follow-up is enough." },
        ],
      },
      {
        heading: "Tone: friendly, not pushy",
        blocks: [
          { t: "p", text: "Sellers sometimes copy the style of big shops: capital letters, many exclamation marks, countdown language. On a personal account this reads as noise. Customers on Instagram expect to hear from a person." },
          { t: "ul", items: [
            "Write the way you would speak to a customer standing at your stall.",
            "Use one emoji at most, and only if it fits how you normally write.",
            "Avoid pressure lines such as “Hurry, last chance”, unless it is true and the reel said so.",
            "Say thank you once. Not three times.",
          ] },
          { t: "h3", text: "Handling the follow-up question" },
          { t: "p", text: "After your template goes out, some buyers will answer with something you did not plan for: a bulk order, a custom colour, a request to change an address. Decide in advance who handles these, and make sure your reply tells people when to expect an answer, for example “We reply to messages between 10 am and 6 pm.”" },
          { t: "p", text: "Setting expectations is a small kindness. A buyer who knows they will hear back tomorrow morning is much calmer than one who hears nothing." },
          { t: "callout", kind: "tip", title: "Pro tip", text: "Keep a document called “Questions I answered by hand”. Each time you type the same reply three times, turn it into a template. Over a few weeks you will build exactly the set your customers need." },
          { t: "h3", text: "One template, many reels" },
          { t: "p", text: "You can reuse a template across reels, but change the product name and the link each time. A reply that mentions the wrong product is the fastest way to lose trust. If you sell many products, give each reel its own keyword and message, even if only the name and link differ." },
        ],
      },
      {
        heading: "Keeping templates fresh",
        blocks: [
          { t: "p", text: "Templates age. Prices change, a size sells out, a link breaks. Pick one day a month to test them: comment on your own reels from a second account and read what arrives." },
          { t: "ul", items: [
            "Click every link in every template.",
            "Compare each price with your shop.",
            "Retire templates for products you no longer sell.",
            "Add a new template for any question you answered by hand more than three times that month.",
          ] },
        ],
      },
      {
        heading: "Seller template checklist",
        blocks: [
          { t: "checklist", title: "Before you switch on a template", items: [
            "The answer comes first.",
            "Exactly one link, and it opens the right product.",
            "The price and currency match your shop.",
            "It ends with a question the buyer can answer in a word.",
            "There is a way to stop messages on any follow-up.",
            "A person will read the replies the same day.",
          ] },
        ],
      },
    ],
  },

  {
    slug: "booking-flows-for-salons-and-coaches",
    title: "Booking flows for salons and coaches: from comment to calendar",
    excerpt: "Two simple conversation flows that turn a comment into a booking request, with the questions to ask, the ones to skip and where a person should step in.",
    category: "Guides",
    date: "2026-11-02",
    readMinutes: 7,
    tldr: [
      "Collect only what you need to confirm a time: service, preferred day and a way to reach them.",
      "Offer a booking link first. Offer a chat as a second option for people who prefer to ask.",
      "Keep a person in the loop for confirmations, changes and anything unusual.",
    ],
    sections: [
      {
        heading: "The goal is a request, not a robot",
        blocks: [
          { t: "p", text: "A salon, a studio or a coaching practice sells time. Every message should move toward one outcome: a confirmed time on your calendar." },
          { t: "p", text: "A booking flow does not need to confirm anything by itself. Its job is to gather what you need and hand it to you in a tidy way. You then confirm, because you know what the diary really looks like." },
        ],
      },
      {
        heading: "Flow 1: for salons and studios",
        blocks: [
          { t: "p", text: "A viewer comments BOOK under a reel about a colour treatment or a haircut. This is the path we suggest." },
          { t: "ol", items: [
            "First message: thank them, send your booking link, and name the one or two services shown in the reel.",
            "If they reply, ask which service they want, in a short list.",
            "Ask for a preferred day or time of day. Not a date, just a leaning, such as weekday evenings.",
            "Ask for the best number or email to confirm.",
            "Say what happens next: “Our team will confirm within one working day.”",
          ] },
          { t: "dm-example", comment: "BOOK", messages: [
            "Hi Priya! Here is our booking page: example.com/book",
            "Would you like help choosing? Reply 1 for cut and style, 2 for colour, 3 for treatment.",
          ], caption: "Link first, chat second.", handle: "priya.v" },
          { t: "callout", kind: "tip", title: "Pro tip", text: "Put the duration and starting price next to each service. It prevents the most common surprise at the chair." },
        ],
      },
      {
        heading: "Flow 2: for coaches and consultants",
        blocks: [
          { t: "p", text: "For coaching, the first question protects both sides. You want to know if you can actually help before you give up an hour of calendar." },
          { t: "ol", items: [
            "First message: deliver the free thing promised, such as a short guide, and say who you help.",
            "Ask one qualifying question, such as what the person is working on right now.",
            "Based on the answer, offer a call link or a better-fitting resource.",
            "Send the call link with the length of the call and what to prepare.",
          ] },
          { t: "p", text: "Keep qualifying to two questions at most. Every extra question loses people, and a long form belongs on your site, not in a chat." },
        ],
      },
      {
        heading: "Make the time feel easy",
        blocks: [
          { t: "p", text: "People abandon bookings when the next step feels heavy. A few small choices make it lighter." },
          { t: "ul", items: [
            "Offer two or three options, not an open question like “when are you free?”",
            "Say how long the visit or call takes.",
            "Show the starting price if you can, so there are no surprises later.",
            "Tell them what happens next, in one sentence.",
          ] },
          { t: "p", text: "Clarity is kinder than cleverness. A plain message that answers what, when and how much will beat a stylish one that leaves questions." },
        ],
      },
      {
        heading: "What to ask, and what to leave out",
        blocks: [
          { t: "h3", text: "Worth asking" },
          { t: "ul", items: [
            "Which service or topic they want.",
            "Rough timing preference.",
            "A contact route, if the chat is not enough.",
          ] },
          { t: "h3", text: "Better to leave out" },
          { t: "ul", items: [
            "Anything sensitive, such as health details, over automated chat.",
            "Payment information. Use a proper payment page.",
            "A long list of preferences. Ask those at the appointment.",
          ] },
          { t: "callout", kind: "warn", title: "Watch out", text: "If you take personal details, tell people how you will use them and link your privacy page. Collect the least you need, and delete what you no longer need." },
        ],
      },
      {
        heading: "Where a person should step in",
        blocks: [
          { t: "p", text: "Automation is good at repeat steps. It is poor at judgement. Plan hand-over points so no one waits in silence." },
          { t: "ul", items: [
            "Confirming the time, because only you know what is actually free.",
            "Changes and cancellations.",
            "Anyone who writes something that does not fit the options.",
            "Anyone who sounds upset.",
          ] },
          { t: "p", text: "A simple rule works: every chat that reaches the booking step goes to a named person’s inbox, with the answers attached, to be handled the same day." },
        ],
      },
      {
        heading: "Writing the confirmation message",
        blocks: [
          { t: "p", text: "Once your team has confirmed a time, the confirmation is the most useful message you will send. It should be short and contain everything a client needs, so they never have to scroll back." },
          { t: "ul", items: [
            "The service, the day and the time, in one line.",
            "The address or call link.",
            "How long it will take.",
            "What to bring or prepare.",
            "How to change or cancel, and by when.",
          ] },
          { t: "p", text: "Send it by the channel the client chose. If they gave you an email, use the email, and keep the chat for quick questions." },
          { t: "h3", text: "Tone for coaches" },
          { t: "p", text: "A coaching call is a relationship, so a warm sentence at the start helps: “Looking forward to our call.” Avoid a long list of rules. If you have a cancellation policy, link to it once." },
        ],
      },
      {
        heading: "Reminders and no-shows",
        blocks: [
          { t: "p", text: "Messaging windows limit how long you can reach someone on Instagram after the last message. For reminders, use a channel that suits it: your booking tool, email or text, with the person’s consent." },
          { t: "p", text: "Ask for the right contact in the chat, and say plainly that you will use it for reminders. People rarely mind a reminder they agreed to." },
        ],
      },
      {
        heading: "Set it up in an afternoon",
        blocks: [
          { t: "checklist", title: "Booking flow checklist", items: [
            "One keyword per service reel.",
            "First message includes the booking link.",
            "A short chat path for people who prefer to ask.",
            "No more than three questions.",
            "A named person gets every finished chat.",
            "A privacy link sits wherever you collect contact details.",
          ] },
        ],
      },
      {
        heading: "Frequently asked questions",
        blocks: [
          { t: "faq", items: [
            { q: "Can the flow book the time by itself?", a: "It can send people to your booking page, which books the time. Confirmations in chat are better left to a person unless your booking tool handles them." },
            { q: "What if two people want the same slot?", a: "That is another reason to let your booking tool or a person confirm. The chat only collects requests." },
          ] },
        ],
      },
    ],
  },
]
