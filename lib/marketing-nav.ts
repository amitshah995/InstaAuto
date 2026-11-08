import {
  Boxes, MessageCircle, Workflow, Inbox, Link2, CalendarCheck, ClipboardCheck, ShoppingBag, KeyRound,
  Clapperboard, Lock, Tags, BarChart3, TrendingUp, Users, LayoutTemplate, LayoutGrid, LifeBuoy,
  GraduationCap, BookOpen, Newspaper, History, Webhook, Table2, ShoppingCart, Plug, CreditCard,
  Camera, Store, Scissors, UtensilsCrossed, Building2, Briefcase, FileText, Layers,
  type LucideIcon,
} from "lucide-react"

/**
 * Single source of truth for the marketing menu, the footer and the placeholder pages.
 * Add an item here and it shows up in the menu and gets its own page.
 */
export type SectionKey = "product" | "features" | "industries" | "resources" | "integrations"

export interface NavItem {
  title: string
  sub: string
  icon: LucideIcon
  href: string
  /** Page copy for items that are served by /[section]/[slug]. Items that link to an existing route have none. */
  page?: PageCopy
}

export interface PageCopy {
  heading: string
  lead: string
  points: [string, string, string]
  /** Shown as a small badge on pages that describe something still being built. */
  status?: "Coming soon" | "Planned"
}

export interface MenuDef {
  key: SectionKey
  label: string
  items: NavItem[]
}

const p = (heading: string, lead: string, points: [string, string, string], status?: PageCopy["status"]): PageCopy => ({ heading, lead, points, status })

export const MENUS: MenuDef[] = [
  {
    key: "product",
    label: "Product",
    items: [
      { title: "Celra Suite", sub: "All tools in one place", icon: Boxes, href: "/product/celra-suite",
        page: p("Every Instagram DM tool in one place", "Comment-to-DM, flows, inbox, reports and a free audit, all in one dashboard so you do not stitch five tools together.", ["Automations, inbox and reports share one contact list", "Invite your team with their own seats", "Start with a ready template, change the words"]) },
      { title: "Comment-to-DM", sub: "Reply to every comment instantly", icon: MessageCircle, href: "/product/comment-to-dm",
        page: p("Turn comments into DMs", "Pick a reel, choose a word like price, write the message. Anyone who comments that word gets your DM.", ["Works on reels and posts you choose", "A public reply and a DM, both written by you", "Pause or edit any automation in one click"]) },
      { title: "DM Flows", sub: "Visual flow builder", icon: Workflow, href: "/product/dm-flows",
        page: p("Build DM conversations visually", "Lay out questions, buttons and replies on a canvas, test the chat on a phone preview, then switch it on.", ["Drag steps, no code needed", "Preview the whole chat before it goes live", "Version history so you can go back"]) },
      { title: "Smart Inbox", sub: "One inbox for your team", icon: Inbox, href: "/product/smart-inbox",
        page: p("One inbox for every conversation", "Automations handle the repeat questions. Your team picks up the rest from a single shared inbox.", ["See the full thread, automated or not", "Tag and note contacts as you reply", "Hand over a chat from bot to human"]) },
      { title: "Link & Price Templates", sub: "Send links and prices", icon: Link2, href: "/product/link-price-templates",
        page: p("Send the link or the price, every time", "Start from a template for links, price lists and product details. Fill in your own words and your own links.", ["Tracked links so you see what gets clicked", "Cards with an image, title and button", "Reuse a template across many posts"]) },
      { title: "Booking Templates", sub: "Collect appointments", icon: CalendarCheck, href: "/product/booking-templates",
        page: p("Collect booking requests in DMs", "Ask for name, date and service in a short chat and get a tidy request for your team to confirm.", ["Short question steps people finish", "Details land on the contact record", "Works for classes, salons, consults"]) },
      { title: "Instagram Audit", sub: "Free profile check", icon: ClipboardCheck, href: "/instagram-audit" },
      { title: "Shop", sub: "Sell inside DMs", icon: ShoppingBag, href: "/product/shop",
        page: p("Show your products, take the order in DMs", "A simple shop page you can link from your bio, with every product one tap away from a conversation.", ["Share one link, show your posts as products", "Customers message you with one tap", "You stay in control of price and stock"], "Planned") },
    ],
  },
  {
    key: "features",
    label: "Features",
    items: [
      { title: "Features overview", sub: "Everything Celra does", icon: LayoutGrid, href: "/features/overview",
        page: p("Everything Celra does", "A quick tour of the tools that turn Instagram attention into conversations.", ["Triggers: comments, stories and messages", "Flows, templates and a shared inbox", "Contacts, reports and team seats"]) },
      { title: "Keyword Triggers", sub: "Start a DM from a word", icon: KeyRound, href: "/features/keyword-triggers",
        page: p("Keyword triggers", "Choose the words that matter. When someone comments one, the right message goes out.", ["Several words per automation", "Match exact words or phrases", "A different reply for each reel"]) },
      { title: "Story Replies", sub: "Answer story mentions and replies", icon: Clapperboard, href: "/features/story-replies",
        page: p("Story replies", "When someone replies to your story, send them an answer without opening the app.", ["Works for replies to your stories", "One message or a short flow", "Same contact list as your comments"]) },
      { title: "Follow-gate", sub: "Ask for a follow before the link", icon: Lock, href: "/features/follow-gate",
        page: p("Follow-gate", "Ask people to follow you before they get the download or the link, and check before you send it.", ["A friendly ask, then the reward", "Works with any template", "You choose the wording"]) },
      { title: "Contacts & Tags", sub: "Know who you talked to", icon: Tags, href: "/features/contacts-tags",
        page: p("Contacts and tags", "Every person who messages you becomes a contact you can search, tag and message again within Instagram's rules.", ["Search and filter your list", "Tag by interest or stage", "Send updates to a tagged group where allowed"]) },
      { title: "Reports & Funnel", sub: "See what gets results", icon: BarChart3, href: "/features/reports-funnel",
        page: p("Reports and funnel", "See how many comments became DMs, and how many of those were opened and clicked.", ["Funnel from comment to click", "Compare automations side by side", "Export when you need to share"]) },
      { title: "Score History", sub: "Track your audit score", icon: TrendingUp, href: "/features/score-history",
        page: p("Score history", "Run the free audit again later and watch your profile score change over time.", ["Every audit saved with its date", "See what moved the score", "Fixes you can turn into automations"]) },
      { title: "Team Seats", sub: "Invite your team", icon: Users, href: "/features/team-seats",
        page: p("Team seats", "Give teammates their own login so everyone can reply, without sharing a password.", ["Invite by link", "See who replied to what", "Switch between client workspaces"]) },
      { title: "Templates Library", sub: "Start from a ready flow", icon: LayoutTemplate, href: "/features/templates-library",
        page: p("Templates library", "Ready-made flows for lead magnets, price questions, giveaways and welcome menus.", ["Read the exact conversation first", "Change every message", "Go live in minutes"]) },
    ],
  },
  {
    key: "industries",
    label: "Industries",
    items: [
      { title: "All industries", sub: "Find your fit", icon: Layers, href: "/industries/all",
        page: p("Celra for every kind of business", "If people ask questions in your comments, Celra can answer them in DMs.", ["Creators, shops, coaches and studios", "Agencies running many accounts", "Start from a template for your type"]) },
      { title: "Creators & Influencers", sub: "Share links and freebies", icon: Camera, href: "/industries/creators",
        page: p("For creators and influencers", "Send the link, the guide or the discount code to everyone who asks, while you keep creating.", ["Lead magnets by comment keyword", "Story reply links", "Follow-gate for your freebies"]) },
      { title: "E-commerce & D2C", sub: "Prices, sizes, order links", icon: Store, href: "/industries/ecommerce",
        page: p("For online shops and D2C brands", "Answer the price and size questions under every product reel, and send the order link.", ["Price and link templates", "Product cards in DMs", "Reports on clicks to your store"]) },
      { title: "Coaches & Courses", sub: "Qualify and book", icon: GraduationCap, href: "/industries/coaches",
        page: p("For coaches and course creators", "Turn a comment into a short chat that qualifies the lead and offers a call or a free lesson.", ["Qualifier flow with a few questions", "Booking template", "Tag leads by interest"]) },
      { title: "Salons & Wellness", sub: "Fill your calendar", icon: Scissors, href: "/industries/salons",
        page: p("For salons, studios and wellness", "Send the service menu, prices and a booking request when someone comments on your reel.", ["Service and price menu", "Booking request chat", "Reminders for your team to confirm"]) },
      { title: "Restaurants & Cafes", sub: "Menus and reservations", icon: UtensilsCrossed, href: "/industries/restaurants",
        page: p("For restaurants and cafes", "Share the menu, timings and table booking details with people who ask under your food reels.", ["Menu and timing replies", "Reservation request chat", "Offer codes with a keyword"]) },
      { title: "Real Estate", sub: "Capture property enquiries", icon: Building2, href: "/industries/real-estate",
        page: p("For real estate teams", "Collect budget, area and contact details from people who comment on a listing reel.", ["Enquiry flow per listing", "Details saved on the contact", "Hand over to an agent in the inbox"]) },
      { title: "Agencies", sub: "Run many accounts", icon: Briefcase, href: "/industries/agencies",
        page: p("For agencies", "Set up and report on automations for several clients from one place, with seats for your team.", ["Switch between client workspaces", "Templates you can reuse", "Reports you can share"]) },
    ],
  },
  {
    key: "resources",
    label: "Resources",
    items: [
      { title: "Help center", sub: "Guides and answers", icon: LifeBuoy, href: "/resources/help-center",
        page: p("Help center", "Step by step guides for setting up your first automation. We are writing them now.", ["Connect your account", "Set up your first keyword", "Fix common issues"], "Coming soon") },
      { title: "Tutorials", sub: "Learn by doing", icon: GraduationCap, href: "/resources/tutorials",
        page: p("Tutorials", "Short walkthroughs for flows, templates and reports.", ["Comment-to-DM in five minutes", "Build a lead magnet flow", "Read your funnel report"], "Coming soon") },
      { title: "Blog", sub: "Ideas for Instagram growth", icon: Newspaper, href: "/blog" },
      { title: "Flow templates", sub: "Ready-made DM flows", icon: LayoutTemplate, href: "/flow-templates" },
      { title: "Audit tool", sub: "Free profile check", icon: ClipboardCheck, href: "/instagram-audit" },
      { title: "Case studies", sub: "How others use Celra", icon: FileText, href: "/resources/case-studies",
        page: p("Case studies", "Real stories from real accounts will live here once we have permission to share them.", ["Written with the account owner", "Real setup, honest results", "Nothing made up"], "Coming soon") },
      { title: "Changelog", sub: "What is new", icon: History, href: "/resources/changelog",
        page: p("Changelog", "A running list of what we ship and fix.", ["New features", "Fixes", "What is coming next"], "Coming soon") },
    ],
  },
  {
    key: "integrations",
    label: "Integrations",
    items: [
      { title: "All integrations", sub: "What connects to Celra", icon: Plug, href: "/integrations/all",
        page: p("Integrations", "We are building ways to send your Celra data to the tools you already use.", ["Webhooks first", "Spreadsheets and stores next", "Tell us what you need"], "Planned") },
      { title: "Webhooks", sub: "Send events to your app", icon: Webhook, href: "/integrations/webhooks",
        page: p("Webhooks", "Send new contacts and completed flows to your own endpoint.", ["Simple JSON events", "Signed requests", "Retry on failure"], "Planned") },
      { title: "Google Sheets", sub: "Save leads to a sheet", icon: Table2, href: "/integrations/google-sheets",
        page: p("Google Sheets", "Add a row to a sheet each time a flow collects a lead.", ["Pick the sheet", "Map the fields", "Keep your list in one place"], "Planned") },
      { title: "Shopify", sub: "Connect your store", icon: ShoppingCart, href: "/integrations/shopify",
        page: p("Shopify", "Send product links and order details from your store inside DMs.", ["Product links in replies", "Order status messages", "Store reports next to funnel"], "Planned") },
      { title: "Automation tools", sub: "Zapier and Make style", icon: Workflow, href: "/integrations/automation-tools",
        page: p("Automation tools", "Connect Celra to thousands of apps through general purpose automation platforms.", ["Triggers from new contacts", "Actions to tag and message", "No code needed"], "Planned") },
      { title: "Payments", sub: "Collect payment links", icon: CreditCard, href: "/integrations/payments",
        page: p("Payments", "Share payment links in a DM and see which conversations led to an order.", ["Payment link templates", "Order placed events", "Works with your own payment account"], "Planned") },
    ],
  },
]

export const TOP_LINKS = { pricing: { label: "Pricing", href: "/pricing" }, partner: { label: "Partner", href: "/partner" } }

/** Copy for the pages served by /[section]/[slug]. */
export function getPage(section: SectionKey, slug: string) {
  const menu = MENUS.find((m) => m.key === section)
  const item = menu?.items.find((i) => i.page && i.href === `/${section}/${slug}`)
  return item && menu ? { item, menu } : null
}

export function slugsFor(section: SectionKey): { slug: string }[] {
  const menu = MENUS.find((m) => m.key === section)
  return (menu?.items ?? []).filter((i) => i.page).map((i) => ({ slug: i.href.split("/").pop() as string }))
}

export const HERO_CTA_LABEL = "Start 14-day free trial"

export const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Platform", links: [
    { label: "Comment-to-DM", href: "/product/comment-to-dm" },
    { label: "DM Flows", href: "/product/dm-flows" },
    { label: "Smart Inbox", href: "/product/smart-inbox" },
    { label: "Reports & Funnel", href: "/features/reports-funnel" },
    { label: "Pricing", href: "/pricing" },
  ] },
  { title: "Resources", links: [
    { label: "Help center", href: "/resources/help-center" },
    { label: "Blog", href: "/blog" },
    { label: "Tutorials", href: "/resources/tutorials" },
    { label: "Flow templates", href: "/flow-templates" },
    { label: "Changelog", href: "/resources/changelog" },
    { label: "Partner program", href: "/partner" },
  ] },
  { title: "Free tools", links: [
    { label: "Instagram Audit", href: "/instagram-audit" },
    { label: "All free tools", href: "/tools" },
    { label: "ManyChat alternative", href: "/manychat-alternative" },
    { label: "Chatfuel alternative", href: "/chatfuel-alternative" },
  ] },
  { title: "Legal", links: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Data Deletion", href: "/delete-data" },
  ] },
]

