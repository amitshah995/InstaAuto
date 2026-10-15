import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { TOOLS, toolBySlug } from "@/lib/tools/registry"
import { TOOL_COMPONENTS } from "@/components/tools"
import { ToolShell } from "@/components/tools/tool-shell"

export const dynamicParams = false

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const tool = toolBySlug(slug)
  if (!tool) return {}
  return {
    title: tool.title,
    description: tool.intro,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: { title: tool.title, description: tool.intro, url: `/tools/${tool.slug}`, type: "website" },
  }
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tool = toolBySlug(slug)
  const Tool = TOOL_COMPONENTS[slug]
  if (!tool || !Tool) notFound()
  return (
    <ToolShell tool={tool}>
      <Tool />
    </ToolShell>
  )
}
