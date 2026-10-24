import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/site"
import { TOOLS } from "@/lib/tools/registry"
import { FLOW_TEMPLATES } from "@/lib/flows/templates"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl()
  const now = new Date()

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/instagram-audit`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tools`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...["manychat-alternative", "chatfuel-alternative", "linkdm-alternative", "meta-review"].map((slug) => ({
      url: `${baseUrl}/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      url: `${baseUrl}/flow-templates`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
    ...FLOW_TEMPLATES.map((t) => ({
      url: `${baseUrl}/flow-templates/${t.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...TOOLS.map((t) => ({
      url: `${baseUrl}/tools/${t.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/delete-data`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.2,
    },
  ]
}

