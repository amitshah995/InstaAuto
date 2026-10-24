import type { Metadata } from "next"
import { AlternativePage } from "@/components/seo/AlternativePage"
import { getAltPage } from "@/lib/seo/alternatives"

const page = getAltPage("manychat-alternative")!

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  alternates: { canonical: "/manychat-alternative" },
}

export default function Page() {
  return <AlternativePage page={page} />
}
