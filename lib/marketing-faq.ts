import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/site"

/** Shared by the on-page FAQ and the FAQPage JSON-LD in app/page.tsx. */
export const FAQS: { q: string; a: string }[] = [
  { q: `What is ${BRAND_NAME}?`, a: `${BRAND_NAME} sends the price, link or details to anyone who comments a keyword on your reel, automatically, using the official Instagram API. It also has DM flows, a shared inbox, reports and a free Instagram audit.` },
  { q: `Is ${BRAND_NAME} free?`, a: `${BRAND_NAME} is free to use while it is in beta. We will tell you clearly before anything changes, and nothing is charged without your yes.` },
  { q: "Do I need a special Instagram account?", a: "Yes. Your account must be an Instagram Business or Creator account (you can switch for free in Instagram settings)." },
  { q: "Is it safe for my account?", a: `${BRAND_NAME} uses the official Instagram API and Instagram's own login, and never asks for your password. Follow Instagram's messaging rules when you write your automations, and keep your messages useful and honest.` },
  { q: "Will it message random people?", a: "No. A DM goes out only to someone who commented your keyword on your reel, or who messaged you first." },
  { q: "Can my team use it?", a: "Yes. Invite teammates with team seats so everyone replies from their own login, and switch between workspaces if you manage several accounts." },
  { q: "How do I stop or delete my data?", a: `Pause or delete any automation inside the dashboard. To remove your data completely, use the data deletion page, or write to ${SUPPORT_EMAIL}.` },
]
