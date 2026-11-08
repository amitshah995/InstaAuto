import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Outfit } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { getSiteUrl, BRAND_NAME } from "@/lib/site"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" })

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${BRAND_NAME}: Instagram comment to DM automation`,
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    `${BRAND_NAME} sends the price, link or details to anyone who comments on your reel, automatically, through the official Instagram API. Includes a free Instagram audit.`,
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
    "dmspark instagram automation",
    "dmspark auto reply",
    "dmspark auto dm",
    "dmspark bot", 
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
    "instagram comment auto reply",
    "instagram auto comment reply",
    "instagram auto message",
    "instagram automation tool free",
    "instagram automation India",
    "instagram auto reply bot",
    "instagram dm bot",
    "instagram auto dm sender",
    "instagram follower growth tool",
    "instagram autopilot",
  ],
  authors: [{ name: BRAND_NAME }],
  creator: BRAND_NAME,
  publisher: BRAND_NAME,
  // No root-level canonical: each page sets its own, otherwise every page would claim the homepage as canonical.
  openGraph: {
    type: "website",
    locale: "en_US",
    url: getSiteUrl(),
    siteName: BRAND_NAME,
    title: `${BRAND_NAME}: Instagram comment to DM automation`,
    description:
      "Comment karo, DM aa jaayega. Auto-reply to Instagram comments with a DM, using the official Instagram API.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME}: Instagram comment to DM automation`,
    description:
      "Comment karo, DM aa jaayega. Auto-reply to Instagram comments with a DM.",
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
    "application-name": BRAND_NAME,
    "msapplication-TileColor": "#0B5C6E",
    "theme-color": "#0B5C6E",
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
      <body className={`${_geist.className} ${outfit.variable} font-sans antialiased`}>
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

