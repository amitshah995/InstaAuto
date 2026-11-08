"use client"

import { useState, useEffect, useCallback } from "react"
import { TopNavbar } from "@/components/layout/top-navbar"
import { useInstagramSession } from "@/hooks/use-instagram-session"
import { CelraLogo } from "@/components/ui/celra-logo"
import { WelcomeScreen } from "@/components/ui/welcome-screen"
import { Loader2, Compass, Copy, Check, MoreVertical, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"
import { ActingBanner } from "@/components/team/ActingBanner"
import { SendHealthBanner } from "@/components/dashboard/SendHealthBanner"
import { UsageBanner } from "@/components/billing/UsageBanner"
import { BRAND_NAME } from "@/lib/site"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { username, userId, logout, isLoading, error } = useInstagramSession()
    const router = useRouter()
    const [profilePictureUrl, setProfilePictureUrl] = useState<string | undefined>(undefined)
    const [isInAppBrowser, setIsInAppBrowser] = useState(false)
    const [copied, setCopied] = useState(false)
    const [showWelcome, setShowWelcome] = useState(false)

    // Show welcome screen for first-time connections
    useEffect(() => {
        if (!userId || !username) return
        const welcomed = sessionStorage.getItem("celra_welcomed")
        if (!welcomed) {
            setShowWelcome(true)
        }
    }, [userId, username])

    const handleWelcomeComplete = useCallback(() => {
        sessionStorage.setItem("celra_welcomed", "true")
        setShowWelcome(false)
    }, [])

    // Detect Instagram App in-app browser webview
    useEffect(() => {
        const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
        const isInstagramWebView = ua.indexOf("Instagram") > -1 || ua.indexOf("FBAN/Instagram") > -1 || ua.indexOf("FBAV") > -1;
        setIsInAppBrowser(isInstagramWebView);
    }, [])

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // Fetch Instagram profile picture dynamically
    useEffect(() => {
        if (!userId) return

        const fetchProfilePicture = async () => {
            try {
                const res = await fetch(`/api/instagram/profile-picture?userId=${userId}`)
                const data = await res.json()
                if (data.success && data.profilePictureUrl) {
                    setProfilePictureUrl(data.profilePictureUrl)
                }
            } catch (err) {
                console.error("Failed to fetch profile picture:", err)
            }
        }

        fetchProfilePicture()
    }, [userId])

    useEffect(() => {
        if (!isLoading && !userId) {
            router.replace("/")
        }
    }, [isLoading, userId, router])

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background text-foreground">
                <div className="flex flex-col items-center gap-4"><CelraLogo variant="mark" size={44} /><Loader2 className="h-5 w-5 animate-spin text-brand" aria-label="Loading" /></div>
            </div>
        )
    }

    // Show Welcome to {BRAND_NAME} screen for first-time connections
    if (showWelcome && userId && username) {
        return (
            <WelcomeScreen
                username={username}
                userId={userId}
                onComplete={handleWelcomeComplete}
            />
        )
    }

    return (
        <div className="min-h-screen w-full bg-background text-foreground transition-colors duration-300 relative">
            <ActingBanner />
            <SendHealthBanner />
            <UsageBanner />
            {/* Google-style Top Navigation Bar */}
            <TopNavbar
                username={username || "User"}
                profilePictureUrl={profilePictureUrl}
                onLogout={logout}
            />

            {/* Main Content Area — full width, scrollable, centered */}
            <main className="w-full min-h-[calc(100vh-3.5rem)]">
                {error && (
                    <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 text-sm mx-4 mt-4 rounded-lg flex items-center gap-2 max-w-4xl lg:mx-auto">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-destructive" />
                        <span>Login Error: {error}</span>
                    </div>
                )}
                {children}
            </main>

            {/* Instagram Webview Browser Breakout Overlay */}
            {isInAppBrowser && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background p-4 sm:p-6 text-foreground select-none font-sans">
                    <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 sm:p-8 text-center space-y-6 relative overflow-hidden">
                        <div className="relative flex flex-col items-center">
                            {/* Animated Glowing Icon Ring */}
                            <CelraLogo variant="mark" size={64} />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-brand">
                                Almost connected
                            </h2>
                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-medium">
                                You are currently inside the Instagram App browser. To access your Dashboard securely, please open this link in your standard web browser (Safari or Chrome).
                            </p>
                        </div>

                        {/* Interactive Steps */}
                        <div className="bg-muted border border-border rounded-2xl p-4 text-left space-y-3.5">
                            <div className="flex gap-3 items-start text-xs sm:text-sm text-foreground">
                                <span className="w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                                <p className="leading-relaxed font-semibold">
                                    Click the **three dots menu (<MoreVertical className="inline-block w-4 h-4 text-muted-foreground align-middle" />)** or **Share icon** at the top right corner of your screen.
                                </p>
                            </div>
                            <div className="flex gap-3 items-start text-xs sm:text-sm text-foreground">
                                <span className="w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                                <p className="leading-relaxed font-semibold">
                                    Select **"Open in System Browser"** or **"Open in Safari"** from the options.
                                </p>
                            </div>
                        </div>

                        {/* Quick Copy Link Helper */}
                        <div className="pt-2">
                            <button
                                onClick={handleCopyLink}
                                className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground border border-primary font-bold text-xs uppercase tracking-wider transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer text-white"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-4 h-4 text-brand" /> Link Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4 text-foreground" /> Copy Dashboard Link
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                            {BRAND_NAME} Secure Redirect
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
