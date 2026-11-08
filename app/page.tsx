"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { GoogleSearchHome } from "@/components/layout/google-home"
import { InstagramConnectAnimation } from "@/components/ui/instagram-connect-animation"
import { BRAND_NAME } from "@/lib/site"
import { Loader2, AlertCircle } from "lucide-react"

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get("code")
    const errorParam = searchParams.get("error")
    const savedId = localStorage.getItem("ig_user_id")
    const savedWaId = localStorage.getItem("wa_user_id")
    const loginType = localStorage.getItem("login_type")

    if (errorParam) {
      setError(`Instagram login error: ${errorParam}`)
      return
    }

    if (code) {
      setProcessing(true)
      localStorage.setItem("login_type", "instagram")
      router.replace("/dashboard?code=" + code)
    } else if (loginType === "whatsapp" && savedWaId) {
      router.replace("/whatsapp-dashboard")
    } else if (savedId) {
      router.replace("/dashboard")
    }
  }, [searchParams, router])

  if (processing) {
    return <InstagramConnectAnimation />
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-background text-foreground gap-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <button 
          onClick={() => { setError(null); router.replace("/") }}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Try again
        </button>
      </div>
    )
  }

  return <GoogleSearchHome />
}

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://www.dmspark.in/#website",
        url: "https://www.dmspark.in",
        name: BRAND_NAME,
        alternateName: ["DMSpark"],
        description:
          `${BRAND_NAME} auto-replies to Instagram comments and DMs with keyword triggers, using the official Instagram API.`,
        publisher: {
          "@type": "Organization",
          name: BRAND_NAME,
          url: "https://www.dmspark.in",
          logo: {
            "@type": "ImageObject",
            url: "https://www.dmspark.in/logo.png",
            width: 512,
            height: 512,
          },
        },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://www.dmspark.in/#app",
        name: BRAND_NAME,
        alternateName: ["DMSpark"],
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Android",
        url: "https://www.dmspark.in",
        description:
          `${BRAND_NAME} sends the price, link or details to anyone who comments on your reel. Auto-reply to comments, DMs, and stories with smart keyword triggers.`,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "INR",
          description: "Free during beta",
        },
        creator: {
          "@type": "Organization",
          name: BRAND_NAME,
          url: "https://www.dmspark.in",
        },
      },
      {
        "@type": "Organization",
        "@id": "https://www.dmspark.in/#organization",
        name: BRAND_NAME,
        alternateName: ["DMSpark"],
        url: "https://www.dmspark.in",
        logo: {
          "@type": "ImageObject",
          url: "https://www.dmspark.in/logo.png",
          width: 512,
          height: 512,
        },
        description:
          `${BRAND_NAME} — Instagram comment-to-DM automation for businesses and creators.`,
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://www.dmspark.in/#breadcrumb",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: `${BRAND_NAME} Home`,
            item: "https://www.dmspark.in",
          },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": "https://www.dmspark.in/#faq",
        mainEntity: [
          {
            "@type": "Question",
            name: `What is ${BRAND_NAME}?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `${BRAND_NAME} is an Instagram comment-to-DM automation tool. It auto-replies to Instagram comments and DMs using keyword triggers, through the official Instagram API.`,
            },
          },
          {
            "@type": "Question",
            name: `How does ${BRAND_NAME} Instagram automation work?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `${BRAND_NAME} works by connecting your Instagram Business or Creator account via the official Meta API. You set up keyword triggers (like 'price', 'link', 'info') and ${BRAND_NAME} automatically replies to comments and sends DMs whenever someone uses those keywords. Replies are sent automatically, even when you are offline.`,
            },
          },
          {
            "@type": "Question",
            name: `Is ${BRAND_NAME} free to use?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `${BRAND_NAME} is currently free to use while it is in beta. You can connect your Instagram account and set up auto-replies at no cost.`,
            },
          },
          {
            "@type": "Question",
            name: `Is ${BRAND_NAME} safe? Does it use the official Instagram API?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `${BRAND_NAME} uses the official Instagram API and signs in with Instagram's own OAuth login; we never ask for your Instagram password. Follow Instagram's messaging rules when you set up automations.`,
            },
          },
          {
            "@type": "Question",
            name: `How is ${BRAND_NAME} different from other Instagram automation tools?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `${BRAND_NAME} uses the official Instagram API (not scraping), supports comment-to-DM and DM automation, and includes a free Instagram audit that turns findings into ready-to-use automations.`,
            },
          },
        ],
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Server-rendered SEO content for Google crawler */}
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-black">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      }>
        <HomeContent />
      </Suspense>
    </>
  )
}
