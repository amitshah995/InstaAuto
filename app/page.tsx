"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { GoogleSearchHome } from "@/components/layout/google-home"
import { InstagramConnectAnimation } from "@/components/ui/instagram-connect-animation"
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
        name: "DMSpark",
        alternateName: [
          "dmspark",
          "dmspark.in",
          "DM Spark",
          "dm spark",
          "DMSPARK",
          "DMspark",
          "dmSpark",
          "dmspark insta automation",
          "dmspark instagram automation",
          "dm spark insta automation",
          "dm spark instagram",
          "dmspark auto reply",
          "dmspark bot",
        ],
        description:
          "DMSpark auto-replies to Instagram comments and DMs with keyword triggers, using the official Instagram API.",
        publisher: {
          "@type": "Organization",
          name: "DMSpark",
          url: "https://www.dmspark.in",
          logo: {
            "@type": "ImageObject",
            url: "https://www.dmspark.in/logo.png",
            width: 512,
            height: 512,
          },
        },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: "https://www.dmspark.in/?q={search_term_string}",
          },
          "query-input": "required name=search_term_string",
        },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://www.dmspark.in/#app",
        name: "DMSpark",
        alternateName: [
          "dmspark",
          "DM Spark",
          "dm spark",
          "dmspark insta automation",
          "Instagram Auto Reply by DMSpark",
        ],
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Android",
        url: "https://www.dmspark.in",
        description:
          "DMSpark is the official Instagram automation platform. Auto-reply to comments, DMs, and stories with smart keyword triggers. Grow your Instagram followers 24/7 on autopilot. Best insta automation tool in India.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "INR",
          description: "Free to start — No credit card required",
        },
        creator: {
          "@type": "Organization",
          name: "DMSpark",
          url: "https://www.dmspark.in",
        },
      },
      {
        "@type": "Organization",
        "@id": "https://www.dmspark.in/#organization",
        name: "DMSpark",
        alternateName: ["DM Spark", "dmspark", "dmspark.in"],
        url: "https://www.dmspark.in",
        logo: {
          "@type": "ImageObject",
          url: "https://www.dmspark.in/logo.png",
          width: 512,
          height: 512,
        },
        description:
          "DMSpark — Instagram comment-to-DM automation for businesses and creators.",
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://www.dmspark.in/#breadcrumb",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "DMSpark Home",
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
            name: "What is DMSpark?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "DMSpark is an Instagram comment-to-DM automation tool. It auto-replies to Instagram comments and DMs using keyword triggers, through the official Instagram API.",
            },
          },
          {
            "@type": "Question",
            name: "How does DMSpark Instagram automation work?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "DMSpark works by connecting your Instagram Business or Creator account via the official Meta API. You set up keyword triggers (like 'price', 'link', 'info') and DMSpark automatically replies to comments and sends DMs whenever someone uses those keywords. Replies are sent automatically, even when you are offline.",
            },
          },
          {
            "@type": "Question",
            name: "Is DMSpark free to use?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "DMSpark is currently free to use while it is in beta. You can connect your Instagram account and set up auto-replies at no cost.",
            },
          },
          {
            "@type": "Question",
            name: "Is DMSpark safe? Does it use the official Instagram API?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "DMSpark uses the official Instagram API and signs in with Instagram's own OAuth login; we never ask for your Instagram password. Follow Instagram's messaging rules when you set up automations.",
            },
          },
          {
            "@type": "Question",
            name: "How is DMSpark different from other Instagram automation tools?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "DMSpark uses the official Instagram API (not scraping), supports comment-to-DM and DM automation, and includes a free Instagram audit that turns findings into ready-to-use automations.",
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
