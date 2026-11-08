import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { getSiteUrl } from "@/lib/site"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "DMSpark — Instagram comment to DM automation",
    template: "%s | DMSpark - Instagram Automation",
  },
  description:
    "DMSpark auto-replies to Instagram comments and DMs with keyword triggers, using the official Instagram API. Includes a free Instagram audit.",
  keywords: [
    // Brand keywords — exact match variations
    "DMSpark",
    "dmspark",
    "dmspark.in",
    "dm spark",
    "DM Spark",
    "DMspark",
    "DMSPARK",
    "dmspark in",
    "dmSpark",
    // Brand + product keywords
    "dmspark insta automation",
    "dmspark instagram automation",
    "dmspark auto reply",
    "dmspark auto dm",
    "dmspark bot",
    "dm spark insta automation",
    "dm spark instagram",
    "dm spark auto reply",
    "dm spark tool",
    "dmspark app",
    "dmspark free",
    "dmspark login",
    "dmspark connect instagram",
    // Generic product keywords
    "Instagram automation",
    "Instagram auto reply",
    "Instagram DM automation",
    "auto reply Instagram comments",
    "Instagram bot",
    "Instagram growth tool",
    "Instagram marketing automation",
    "Instagram keyword trigger",
    "auto DM Instagram",
    "Instagram business automation",
    "social media automation",
    "insta automation",
    "insta auto reply",
    "insta bot",
    "insta dm automation",
    "instagram comment auto reply",
    "instagram auto comment reply",
    "instagram auto message",
    "instagram automation tool free",
    "instagram automation India",
    "best instagram automation tool",
    "instagram auto reply bot",
    "instagram dm bot",
    "instagram auto dm sender",
    "instagram follower growth tool",
    "instagram autopilot",
  ],
  authors: [{ name: "DMSpark", url: "https://www.dmspark.in" }],
  creator: "DMSpark",
  publisher: "DMSpark",
  // No root-level canonical: each page sets its own, otherwise every page would claim the homepage as canonical.
  openGraph: {
    type: "website",
    locale: "en_US",
    url: getSiteUrl(),
    siteName: "DMSpark",
    title: "DMSpark — Instagram comment to DM automation",
    description:
      "Auto-reply to Instagram comments and DMs with keyword triggers, using the official Instagram API.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "DMSpark",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DMSpark — Instagram comment to DM automation",
    description:
      "DMSpark auto-replies to Instagram comments and DMs with keyword triggers.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "application-name": "DMSpark",
    "msapplication-TileColor": "#1a73e8",
    "theme-color": "#1a73e8",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/logo.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${_geist.className} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Analytics />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}

