import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/whatsapp-dashboard/", "/l/", "/shop/", "/@"],
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/whatsapp-dashboard/", "/l/", "/shop/", "/@"],
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
    host: getSiteUrl(),
  }
}

