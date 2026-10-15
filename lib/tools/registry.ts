export type ToolCategory = "Growth & analytics" | "Content" | "Messaging" | "Text & formatting"

export interface ToolMeta {
  slug: string
  name: string
  short: string
  category: ToolCategory
  icon: string
  /** <title> (the site template appends the brand). */
  title: string
  h1: string
  intro: string
  /** Lead capture offer shown under the result. */
  offer: { headline: string; text: string; button: string }
  faq: [string, string][]
}

export const TOOLS: ToolMeta[] = [
  {
    slug: "engagement-calculator",
    name: "Engagement Rate Calculator",
    short: "Check your Instagram engagement rate against a working target for your size.",
    category: "Growth & analytics",
    icon: "Heart",
    title: "Free Instagram Engagement Rate Calculator",
    h1: "Instagram engagement rate calculator",
    intro: "Type your followers and your average likes and comments. See your engagement rate and how it compares with a working target for accounts your size.",
    offer: { headline: "Want a plan to raise your engagement?", text: "Leave your details and we will send a short checklist and review your account.", button: "Send me the plan" },
    faq: [
      ["How is engagement rate calculated?", "Average likes plus comments per post, divided by followers, times 100. Add saves and shares if you track them."],
      ["What is a good engagement rate?", "It depends on account size: smaller accounts usually engage more. The target shown here is a working guide, not an official Instagram benchmark."],
      ["Does this tool need my Instagram login?", "No. You type the numbers yourself. Nothing is read from your account."],
    ],
  },
  {
    slug: "comment-to-dm-calculator",
    name: "Comment-to-DM Calculator",
    short: "See how many DMs, clicks and sales automatic comment replies can bring.",
    category: "Growth & analytics",
    icon: "MessageCircle",
    title: "Comment to DM Calculator for Instagram",
    h1: "Comment-to-DM calculator",
    intro: "Estimate the leads and sales you leave on the table when comments like \"price?\" or \"link\" are answered late. Every assumption below is editable.",
    offer: { headline: "Turn these numbers into real replies", text: "We will show you how to set up comment-to-DM automation for your account.", button: "Show me how" },
    faq: [
      ["Are these numbers real?", "They are estimates from the assumptions you enter. Change them to match your own account."],
      ["What does comment-to-DM mean?", "Someone comments a keyword on your post, and an instant private message with the link or answer is sent to them."],
    ],
  },
  {
    slug: "dm-roi-calculator",
    name: "DM Automation ROI Calculator",
    short: "Work out the hours and money saved by automating Instagram DM replies.",
    category: "Growth & analytics",
    icon: "Calculator",
    title: "Instagram DM Automation ROI Calculator",
    h1: "DM automation ROI calculator",
    intro: "Enter how many DMs you get and how long each takes. See hours saved, money saved and payback time.",
    offer: { headline: "Get a custom ROI estimate", text: "Share your details and we will check these numbers against your real inbox volume.", button: "Get my estimate" },
    faq: [
      ["How is ROI calculated?", "Net gain (time saved plus extra sales, minus the tool cost) divided by the tool cost."],
      ["Which DMs can be automated?", "Repeated questions such as price, location, timing, links and order status. Personal or complex chats still need a person."],
    ],
  },
  {
    slug: "chat-link-generator",
    name: "Instagram Chat Link & QR Generator",
    short: "Make an ig.me link and QR code that opens a DM with your account.",
    category: "Messaging",
    icon: "Link2",
    title: "Instagram DM Link & QR Code Generator (ig.me)",
    h1: "Instagram chat link and QR code generator",
    intro: "Enter your username to get a link that opens a chat with you. Put it in your bio, stories, ads, WhatsApp status or print the QR code.",
    offer: { headline: "Reply to every chat instantly", text: "Leave your details and we will show you how to auto-reply to the people who message you.", button: "Show me" },
    faq: [
      ["What is an ig.me link?", "A short link that opens an Instagram chat with your account. It works on phones with the Instagram app installed."],
      ["Does the QR code expire?", "No. It encodes the link itself, so it works as long as your username stays the same."],
    ],
  },
  {
    slug: "caption-checker",
    name: "Instagram Caption Checker",
    short: "Preview the part people see before \"more\" and fix weak captions.",
    category: "Content",
    icon: "FileText",
    title: "Free Instagram Caption Checker & Preview",
    h1: "Instagram caption checker",
    intro: "Paste your caption. See what shows before the \"more\" tap, then check length, hashtags, call to action and readability.",
    offer: { headline: "Want captions that bring leads?", text: "Leave your details and we will send caption ideas and review your last posts.", button: "Send me ideas" },
    faq: [
      ["How many characters can an Instagram caption have?", "Captions are limited to 2,200 characters. Only the first lines show before the \"more\" button."],
      ["How many hashtags should I use?", "A small set of relevant hashtags works best. Instagram changes its guidance, so check the current advice before you post."],
    ],
  },
  {
    slug: "hook-checker",
    name: "Reel Hook Checker",
    short: "Check your Reel's first line and get rewrite ideas using proven hook formulas.",
    category: "Content",
    icon: "Zap",
    title: "Instagram Reel Hook Checker & Rewrite Ideas",
    h1: "Reel hook checker",
    intro: "Paste the first line of your Reel. We check length, clarity and structure, and suggest rewrites. It is a checklist for weak hooks, not a prediction of views.",
    offer: { headline: "Get hook ideas for your niche", text: "Leave your details and we will send hook ideas that fit your content.", button: "Send me hooks" },
    faq: [
      ["Can this predict if my Reel will go viral?", "No. It only flags common problems such as long openers and filler. Results still depend on the video, the audience and timing."],
      ["How long should a hook be?", "Short enough to read or hear in about three seconds, usually 12 words or fewer."],
    ],
  },
  {
    slug: "reel-beat-sheet",
    name: "Reel Script & Beat Sheet",
    short: "Turn a topic into a timed Reel outline: hook, value, proof and call to action.",
    category: "Content",
    icon: "Clapperboard",
    title: "Instagram Reel Script & Beat Sheet Generator",
    h1: "Reel script and beat sheet",
    intro: "Pick a topic, a length and a goal. Get a timed outline you can film from, with a comment keyword call to action.",
    offer: { headline: "Want us to plan your Reels?", text: "Leave your details and we will share a content plan for your account.", button: "Plan my Reels" },
    faq: [
      ["Is the script written by AI?", "No. It is a fixed structure filled in with your topic, so you add your own words and voice."],
      ["What is a comment keyword call to action?", "You ask viewers to comment a word, such as LINK, and an automatic reply sends them the details by DM."],
    ],
  },
  {
    slug: "dm-templates",
    name: "Instagram DM Templates",
    short: "Ready-to-use DM replies for prices, links, bookings and follow-ups.",
    category: "Messaging",
    icon: "MessagesSquare",
    title: "Free Instagram DM Reply Templates",
    h1: "Instagram DM reply templates",
    intro: "Pick a situation, fill in your details and copy a message that sounds friendly and gets answers.",
    offer: { headline: "Send these replies automatically", text: "Leave your details and we will help you set these up as automatic replies.", button: "Set them up for me" },
    faq: [
      ["Can I send the same DM to many people?", "Send private replies to people who contacted you or commented. Do not send unsolicited bulk messages, which Instagram can restrict."],
      ["How do I automate these?", "Connect your account to an automation tool that replies to chosen keywords in comments and DMs."],
    ],
  },
  {
    slug: "creator-pricing-calculator",
    name: "Influencer Rate Calculator",
    short: "Get a rough price range for sponsored posts, Reels and stories.",
    category: "Growth & analytics",
    icon: "IndianRupee",
    title: "Instagram Influencer Rate Calculator (India)",
    h1: "Influencer rate calculator",
    intro: "Enter your followers, engagement and niche. Get a rough price range per post, carousel, Reel and story in rupees.",
    offer: { headline: "Want brand deals and a media kit?", text: "Leave your details and we will help you pitch brands with your numbers.", button: "Help me pitch" },
    faq: [
      ["Is this the price I should charge?", "No. It is a rough starting range from simple rules. Real rates depend on your audience, results and the brand."],
      ["Why does engagement change the price?", "Brands pay for attention, so an account that engages above target can ask for more."],
    ],
  },
  {
    slug: "fancy-fonts-generator",
    name: "Fancy Fonts Generator",
    short: "Turn text into bold, italic, script and other styles for bios and captions.",
    category: "Text & formatting",
    icon: "Type",
    title: "Instagram Fancy Fonts Generator (Copy & Paste)",
    h1: "Fancy fonts generator for Instagram",
    intro: "Type your text and copy any style into your bio, name or caption. These are special characters, so they work anywhere text does.",
    offer: { headline: "Make your bio turn visitors into leads", text: "Leave your details and we will review your bio and link for free.", button: "Review my bio" },
    faq: [
      ["Do fancy fonts work on Instagram?", "Yes, they are Unicode characters that you paste like normal text."],
      ["Are there downsides?", "Screen readers can read them badly and some characters may not show on older phones. Use them for short text, not whole captions."],
    ],
  },
  {
    slug: "caption-formatter",
    name: "Caption Line Break Formatter",
    short: "Keep your spacing and line breaks when you paste a caption into Instagram.",
    category: "Text & formatting",
    icon: "AlignLeft",
    title: "Instagram Line Break & Caption Formatter",
    h1: "Caption line break formatter",
    intro: "Paste your caption. We keep your blank lines with an invisible spacer so Instagram does not squash your paragraphs.",
    offer: { headline: "Want captions that sell?", text: "Leave your details and we will send caption formulas for lead generation.", button: "Send me formulas" },
    faq: [
      ["Why does Instagram remove my line breaks?", "Some ways of pasting text drop empty lines. A spacer character on the empty line keeps the gap."],
      ["Is it safe to use?", "Yes. The spacer is a normal invisible character. It is not visible to your followers."],
    ],
  },
  {
    slug: "giveaway-picker",
    name: "Giveaway Winner Picker",
    short: "Pick fair random winners from a list of commenters.",
    category: "Growth & analytics",
    icon: "Gift",
    title: "Instagram Giveaway Winner Picker (Random)",
    h1: "Giveaway winner picker",
    intro: "Paste the usernames of the people who entered, remove duplicates, and pick winners at random with backups.",
    offer: { headline: "Run giveaways on autopilot", text: "Leave your details and we will show you how to collect entries and reply automatically.", button: "Show me" },
    faq: [
      ["How do I get the list of commenters?", "Copy usernames from your comments or export them from your tool. This page cannot read your comments because it never logs in to Instagram."],
      ["Is the pick random?", "Yes. It uses your browser's secure random number generator."],
    ],
  },
  {
    slug: "carousel-text-splitter",
    name: "Carousel Text Splitter",
    short: "Split a long text into slide-sized parts for a carousel.",
    category: "Content",
    icon: "Layers",
    title: "Instagram Carousel Text Splitter",
    h1: "Carousel text splitter",
    intro: "Paste your text and set how much fits on a slide. Get numbered slides ready to copy into your design.",
    offer: { headline: "Want carousels that bring leads?", text: "Leave your details and we will send carousel ideas and a lead-capture layout.", button: "Send me ideas" },
    faq: [
      ["How long should a carousel slide be?", "Short enough to read in a few seconds. About 120 to 220 characters works for most designs."],
      ["Does it cut words in half?", "No. It splits on paragraphs and sentences first, then on words."],
    ],
  },
  {
    slug: "instagram-image-sizes",
    name: "Social Media Image Sizes",
    short: "A cheat sheet of image and video sizes for Instagram and other platforms.",
    category: "Content",
    icon: "Ruler",
    title: "Instagram Image & Video Sizes Cheat Sheet",
    h1: "Social media image and video sizes",
    intro: "The sizes and ratios for posts, Reels, stories, carousels and profile photos, plus other common platforms.",
    offer: { headline: "Want a content plan with the right formats?", text: "Leave your details and we will suggest a posting plan for your account.", button: "Get a plan" },
    faq: [
      ["What is the best size for an Instagram post?", "1080 x 1350 pixels (4:5) takes the most room in the feed. Square 1080 x 1080 also works."],
      ["What size are Reels?", "1080 x 1920 pixels (9:16). Keep text away from the top and bottom edges."],
    ],
  },
]

export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug)
export const CATEGORIES: ToolCategory[] = ["Growth & analytics", "Content", "Messaging", "Text & formatting"]
