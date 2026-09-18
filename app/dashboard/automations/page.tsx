"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useInstagramSession } from "@/hooks/use-instagram-session"
import { AutomationList } from "@/components/dashboard/AutomationList"
import { CreateRuleForm } from "@/components/dashboard/CreateRuleForm"
import { MessageCircle, Send, Sparkles, Zap, Plus, Loader2, X, RefreshCw, Eye, Flame, Inbox, Heart, MessageSquare, Radio, LayoutTemplate, ArrowRight } from "lucide-react"
import { IceBreakersManager } from "@/components/dashboard/IceBreakersManager"
import type { Automation } from "@/lib/types"
import { AUTOMATION_TEMPLATES, TEMPLATE_GOALS, type AutomationTemplate } from "@/lib/automation-templates"

const TRIGGER_SOURCE_LABEL: Record<string, string> = { comment: "Comments", dm: "DMs", story: "Stories", live: "Live" }
const TEMPLATE_BADGE_STYLE: Record<string, string> = {
    Popular: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    New: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
}

export default function AutomationsPage() {
    const { userId, isLoading: isSessionLoading } = useInstagramSession()
    const router = useRouter()
    const [automations, setAutomations] = useState<Automation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'comment' | 'dm' | 'story' | 'live'>('comment')
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [showTemplates, setShowTemplates] = useState(false)
    const [selectedTemplate, setSelectedTemplate] = useState<AutomationTemplate | null>(null)
    const [creatingFlowTemplate, setCreatingFlowTemplate] = useState(false)

    const startFlowTemplate = async (t: AutomationTemplate) => {
        if (!userId || !t.flowContent || creatingFlowTemplate) return
        setCreatingFlowTemplate(true)
        try {
            const res = await fetch("/api/automations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    name: t.title,
                    trigger_source: t.triggerSource,
                    trigger_type: t.flowContent.triggerType,
                    trigger_value: t.flowContent.triggerValue,
                    content: {
                        flow: { startNodeId: t.flowContent.startNodeId, nodes: t.flowContent.nodes },
                        check_follow: false,
                    },
                }),
            })
            const data = await res.json()
            if (res.ok && data?.id) {
                setShowTemplates(false)
                router.push(`/dashboard/flow-builder?id=${data.id}`)
            }
        } catch (err) {
            console.error("Failed to create flow template:", err)
        } finally {
            setCreatingFlowTemplate(false)
        }
    }

    // Simulation states
    const [previewAutomation, setPreviewAutomation] = useState<Automation | null>(null)
    const [previewStep, setPreviewStep] = useState<"trigger" | "delay" | "reply" | "done">("trigger")
    const [isSimulating, setIsSimulating] = useState(false)

    const fetchAutomations = useCallback(async () => {
        if (!userId) return
        try {
            const res = await fetch(`/api/automations?userId=${userId}`)
            const data = await res.json()
            if (res.ok) setAutomations(Array.isArray(data) ? data : [])
        } catch (err) {
            console.error("Fetch error:", err)
        } finally {
            setIsLoading(false)
        }
    }, [userId])

    useEffect(() => {
        if (userId) fetchAutomations()
    }, [userId, fetchAutomations])

    // Automatically open create form if query parameter 'create' is set to true
    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search)
            if (params.get("create") === "true") {
                setShowCreateForm(true)
            }
        }
    }, [])

    const handleDeleteRule = async (id: string) => {
        await fetch(`/api/automations?id=${id}&userId=${userId}`, { method: "DELETE" })
        fetchAutomations()
    }

    // Trigger simulation sequence
    const runSimulation = useCallback((rule: Automation) => {
        setPreviewStep("trigger")
        setIsSimulating(true)
        
        const delaySeconds = rule.response_content?.delay_seconds || 0
        
        setTimeout(() => {
            if (delaySeconds > 0) {
                setPreviewStep("delay")
                // Custom 2.5 seconds typing bubble in simulation mode for immediate user feedback
                setTimeout(() => {
                    setPreviewStep("reply")
                    setTimeout(() => {
                        setIsSimulating(false)
                        setPreviewStep("done")
                    }, 1200)
                }, 2200)
            } else {
                setPreviewStep("reply")
                setTimeout(() => {
                    setIsSimulating(false)
                    setPreviewStep("done")
                }, 1200)
            }
        }, 1200)
    }, [])

    useEffect(() => {
        if (previewAutomation) {
            runSimulation(previewAutomation)
        }
    }, [previewAutomation, runSimulation])

    if (isSessionLoading) return <div className="h-screen flex items-center justify-center bg-background"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
    if (!userId) return <div className="h-screen flex items-center justify-center bg-background text-muted-foreground">Please log in</div>

    const filteredAutomations = automations.filter(a => a.trigger_source === activeTab)
    const counts = {
        comment: automations.filter(a => a.trigger_source === 'comment').length,
        dm: automations.filter(a => a.trigger_source === 'dm').length,
        story: automations.filter(a => a.trigger_source === 'story').length,
        live: automations.filter(a => a.trigger_source === 'live').length,
    }

    const tabs = [
        { key: 'comment' as const, icon: <MessageCircle className="w-4 h-4" />, label: 'Comments', count: counts.comment },
        { key: 'dm' as const, icon: <Send className="w-4 h-4" />, label: 'DMs', count: counts.dm },
        { key: 'story' as const, icon: <Sparkles className="w-4 h-4" />, label: 'Stories', count: counts.story },
        { key: 'live' as const, icon: <Radio className="w-4 h-4" />, label: 'Live', count: counts.live },
    ]

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 text-foreground transition-colors duration-300 pb-20 md:pb-8">
            <div className="max-w-3xl mx-auto space-y-4 md:space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-2xl font-bold text-foreground tracking-tight">
                                Automations
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary text-muted-foreground border border-border/60">
                                {automations.length}
                            </span>
                        </div>
                        <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                            Manage instant keyword triggers, auto-replies, and DM funnels.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowTemplates(true)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer justify-center shadow-xs bg-secondary text-foreground hover:bg-muted border border-border"
                        >
                            <LayoutTemplate className="w-4 h-4" />
                            Templates
                        </button>
                        <button
                            onClick={() => { setSelectedTemplate(null); setShowCreateForm(!showCreateForm) }}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all active:scale-95 cursor-pointer w-full sm:w-auto justify-center shadow-xs ${
                                showCreateForm
                                    ? 'bg-secondary text-foreground hover:bg-muted border border-border'
                                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                            }`}
                        >
                            <Plus className={`w-4 h-4 transition-transform duration-200 ${showCreateForm ? 'rotate-45' : ''}`} />
                            {showCreateForm ? 'Close' : 'New Rule'}
                        </button>
                    </div>
                </div>

                {/* Google-style Clean Pill Tabs */}
                <div className="flex gap-1.5 bg-secondary/50 p-1 rounded-full border border-border/60">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                                activeTab === tab.key
                                    ? 'bg-background text-foreground shadow-xs border border-border/50 font-semibold'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70'
                            }`}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            {tab.count > 0 && (
                                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-all ${
                                    activeTab === tab.key ? 'bg-primary/10 text-primary' : 'bg-card text-muted-foreground border border-border/40'
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Create Form (Collapsible) */}
                {showCreateForm && (
                    <div className="rounded-2xl border border-border bg-card/40 p-4 md:p-6 animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm">
                        {selectedTemplate && (
                            <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <LayoutTemplate className="w-3.5 h-3.5 text-primary" /> Starting from "{selectedTemplate.title}" — edit anything below
                                </span>
                                <button
                                    onClick={() => setSelectedTemplate(null)}
                                    className="text-[11px] font-bold text-muted-foreground hover:text-foreground"
                                >
                                    Clear
                                </button>
                            </div>
                        )}
                        <CreateRuleForm
                            key={selectedTemplate?.id || 'blank'}
                            userId={userId}
                            triggerSource={activeTab}
                            template={selectedTemplate}
                            onSuccess={() => {
                                fetchAutomations()
                                setShowCreateForm(false)
                                setSelectedTemplate(null)
                            }}
                        />
                    </div>
                )}

                {/* Templates Picker Modal */}
                {showTemplates && (
                    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="absolute inset-0" onClick={() => setShowTemplates(false)} />
                        <div className="relative bg-card border border-border rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-200">
                            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
                                <div>
                                    <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
                                        <LayoutTemplate className="w-5 h-5 text-primary" /> Templates
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Start from a ready-made automation, then customize it.</p>
                                </div>
                                <button
                                    onClick={() => setShowTemplates(false)}
                                    className="w-8 h-8 rounded-full bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {TEMPLATE_GOALS.map((goal) => {
                                    const templatesForGoal = AUTOMATION_TEMPLATES.filter((t) => t.goal === goal)
                                    if (templatesForGoal.length === 0) return null
                                    return (
                                        <div key={goal} className="space-y-3">
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">{goal}</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {templatesForGoal.map((t) => (
                                                    <button
                                                        key={t.id}
                                                        disabled={creatingFlowTemplate}
                                                        onClick={() => {
                                                            if (t.kind === "flow") {
                                                                startFlowTemplate(t)
                                                                return
                                                            }
                                                            setSelectedTemplate(t)
                                                            setActiveTab(t.triggerSource)
                                                            setShowCreateForm(true)
                                                            setShowTemplates(false)
                                                        }}
                                                        className="text-left p-4 rounded-2xl border border-border bg-secondary/20 hover:bg-secondary/50 hover:border-primary/40 transition-all group disabled:opacity-60 disabled:cursor-wait"
                                                    >
                                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background px-2 py-0.5 rounded-full border border-border/60">
                                                                    {TRIGGER_SOURCE_LABEL[t.triggerSource]}
                                                                </span>
                                                                {t.kind === "flow" && (
                                                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border bg-indigo-500/10 text-indigo-600 border-indigo-500/20 flex items-center gap-1">
                                                                        <Zap className="w-2.5 h-2.5" /> Flow Builder
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {t.badge && (
                                                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${TEMPLATE_BADGE_STYLE[t.badge]}`}>
                                                                    {t.badge}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                                            {t.title}
                                                            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-primary" />
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{t.description}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Standard Automation List for Comments, DMs, and Stories */}

                {/* Automation List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    </div>
                ) : (
                    <AutomationList
                        automations={filteredAutomations}
                        onDelete={handleDeleteRule}
                        onUpdate={fetchAutomations}
                        userId={userId}
                        onPreview={(rule) => setPreviewAutomation(rule)}
                    />
                )}
            </div>

            {/* Premium Smartphone Automation Simulation Modal */}
            {previewAutomation && (
                <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
                    {/* Backdrop closer */}
                    <div className="absolute inset-0" onClick={() => setPreviewAutomation(null)} />

                    <div className="relative bg-card/95 border border-border rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-5 w-full max-w-[280px] animate-in zoom-in-95 duration-200 z-10 text-center">
                        <button
                            onClick={() => setPreviewAutomation(null)}
                            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors h-7 w-7 rounded-full bg-secondary flex items-center justify-center cursor-pointer border border-border/50"
                            title="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="space-y-1">
                            <h3 className="font-extrabold text-foreground text-sm tracking-tight flex items-center gap-1.5 justify-center">
                                <Eye className="w-4 h-4 text-green-500" /> Automation Live Preview
                            </h3>
                            <p className="text-[10.5px] text-muted-foreground truncate w-full max-w-[220px] font-medium leading-none">
                                Rule: {previewAutomation.name}
                            </p>
                        </div>

                        {/* Interactive Smartphone Mockup */}
                        <div className="relative bg-white border-[6px] border-slate-900 rounded-[34px] shadow-2xl w-[200px] h-[360px] flex flex-col justify-between overflow-hidden shrink-0 select-none bg-slate-50">
                            {/* Smartphone Island/Notch */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-3 bg-slate-900 rounded-b-lg z-20" />

                            {/* Instagram Header Mock */}
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-2 pt-4 px-3 shrink-0 bg-white/95 backdrop-blur-sm z-10">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#fbbc04] via-[#ea4335] to-[#1a73e8] p-0.5">
                                    <div className="w-full h-full rounded-full bg-white p-0.5">
                                        <img src="/logo.png" alt="Profile" className="w-full h-full object-contain rounded-full" />
                                    </div>
                                </div>
                                <div className="text-left">
                                    <p className="text-[9px] font-black text-slate-800 leading-none">dmspark_bot</p>
                                    <p className="text-[6.5px] text-slate-400 mt-0.5 uppercase tracking-wider font-semibold">Instagram Direct</p>
                                </div>
                            </div>

                            {/* Scrolling Chat Canvas Content */}
                            <div className="relative flex-1 bg-slate-50/50 p-2.5 flex flex-col gap-2.5 overflow-hidden">
                                
                                {/* Step 1: User comment/DM trigger */}
                                {(previewStep === "trigger" || previewStep === "delay" || previewStep === "reply" || previewStep === "done") && (
                                    <div className="flex items-start gap-1.5 animate-in slide-in-from-left duration-300">
                                        <div className="w-5.5 h-5.5 rounded-full bg-slate-200 flex items-center justify-center text-[7px] font-bold text-slate-500 shrink-0 select-none uppercase">U</div>
                                        <div className="bg-white rounded-xl rounded-tl-none p-1.5 max-w-[85%] border border-slate-200/50 shadow-sm text-left">
                                            <p className="text-[7px] font-black text-slate-800 leading-none">user_101</p>
                                            <p className="text-[8.5px] text-slate-600 mt-0.5 font-bold leading-normal">
                                                {previewAutomation.trigger_source === "comment"
                                                    ? `Commented: "${previewAutomation.trigger_value}"`
                                                    : previewAutomation.trigger_source === "live"
                                                        ? `Live comment: "${previewAutomation.trigger_value}"`
                                                        : `DM: "${previewAutomation.trigger_value}"`}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: Delay Wait typing indicators */}
                                {previewStep === "delay" && (
                                    <div className="flex items-start gap-1.5 justify-end">
                                        <div className="bg-slate-200/60 rounded-xl rounded-tr-none px-2 py-1.5 flex items-center gap-1">
                                            <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0s' }} />
                                            <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
                                            <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0.4s' }} />
                                        </div>
                                        <div className="w-5.5 h-5.5 rounded-full bg-blue-100 flex items-center justify-center p-0.5 border border-blue-200/30 shrink-0">
                                            <img src="/logo.png" alt="Profile" className="w-full h-full object-contain rounded-full" />
                                        </div>
                                    </div>
                                )}

                                {/* Step 3: Bot DM auto-reply bubble */}
                                {(previewStep === "reply" || previewStep === "done") && (
                                    <div className="flex items-start gap-1.5 justify-end animate-in slide-in-from-right duration-300">
                                        <div className="flex flex-col gap-1 items-end max-w-[85%]">
                                            {previewAutomation.response_content?.card ? (
                                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm text-left w-full">
                                                    {previewAutomation.response_content.card.image_url && (
                                                        <img 
                                                            src={previewAutomation.response_content.card.image_url} 
                                                            alt="Preview Card" 
                                                            className="w-full h-20 object-cover border-b border-slate-100"
                                                            onError={(e) => {
                                                                (e.target as HTMLElement).style.display = 'none';
                                                            }}
                                                        />
                                                    )}
                                                    <div className="p-2 space-y-1">
                                                        <p className="text-[8px] font-black text-slate-800 leading-tight">
                                                            {previewAutomation.response_content.card.title}
                                                        </p>
                                                        {previewAutomation.response_content.card.subtitle && (
                                                            <p className="text-[7px] text-slate-500 font-medium leading-tight">
                                                                {previewAutomation.response_content.card.subtitle}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {previewAutomation.response_content.card.buttons && previewAutomation.response_content.card.buttons.length > 0 && (
                                                        <div className="border-t border-slate-100 flex flex-col text-center divide-y divide-slate-100">
                                                            {previewAutomation.response_content.card.buttons.map((btn: any, btnIdx: number) => (
                                                                <div 
                                                                    key={btnIdx} 
                                                                    className="py-1 text-[7px] font-bold text-blue-500 bg-white hover:bg-slate-50 cursor-pointer select-none truncate px-1"
                                                                >
                                                                    {btn.title || "Button"}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="bg-[#1a73e8] text-white rounded-xl rounded-tr-none p-1.5 shadow-md shadow-blue-500/10 text-left w-fit">
                                                    <div className="flex items-center gap-1 shrink-0 select-none">
                                                        <img src="/logo.png" alt="DMSpark" className="w-2.5 h-2.5 object-contain brightness-0 invert" />
                                                        <span className="text-[6.5px] font-black uppercase tracking-wider opacity-85">DMSpark</span>
                                                    </div>
                                                    <p className="text-[8.5px] mt-0.5 leading-snug font-semibold text-white break-words">
                                                        {previewAutomation.response_content?.message || "Sent!"}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="w-5.5 h-5.5 rounded-full bg-blue-100 flex items-center justify-center p-0.5 border border-blue-200/30 shrink-0">
                                            <img src="/logo.png" alt="Profile" className="w-full h-full object-contain rounded-full" />
                                        </div>
                                    </div>
                                )}

                            </div>

                            {/* Interaction Footer Bar */}
                            <div className="border-t border-slate-100 p-2 flex items-center justify-between text-[7px] text-slate-500 font-bold shrink-0 bg-white select-none">
                                <span className="text-slate-400">Simulation View</span>
                                {previewStep === "delay" && (
                                    <span className="text-amber-500 font-black animate-pulse uppercase tracking-wider flex items-center gap-0.5 shrink-0">
                                        ⏳ Waiting {previewAutomation.response_content?.delay_seconds || 0}s...
                                    </span>
                                )}
                                {previewStep === "reply" && (
                                    <span className="text-green-500 font-black uppercase tracking-wider flex items-center gap-0.5 shrink-0">
                                        <span className="w-1 h-1 rounded-full bg-green-500 animate-ping" /> Sent!
                                    </span>
                                )}
                                {previewStep === "done" && (
                                    <span className="text-blue-500 font-black uppercase tracking-wider shrink-0">
                                        Completed
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Replay Option */}
                        <button
                            onClick={() => runSimulation(previewAutomation)}
                            disabled={isSimulating}
                            className="w-full h-9 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-border hover:bg-secondary cursor-pointer mt-1 bg-transparent text-foreground transition-all"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} /> Replay Simulation
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
