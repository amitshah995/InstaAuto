"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useInstagramSession } from "@/hooks/use-instagram-session"
import {
  Play,
  MessageSquare,
  Clock,
  Zap,
  Plus,
  Trash2,
  Save,
  ChevronRight,
  Info,
  Sliders,
  Maximize2,
  Compass,
  ArrowRight,
  Loader2,
  ArrowLeft,
  GitBranch,
  Link2,
  X
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface Node {
  id: string
  type: "trigger" | "message" | "delay" | "action" | "condition"
  x: number
  y: number
  title: string
  content: string
  extra?: string
  delaySeconds?: number // message nodes only — seconds to wait before sending
}

interface Connection {
  id: string
  fromId: string
  toId: string
  // Only meaningful when fromId is a "condition" node: the keyword that
  // routes to this branch. Empty/undefined = the default/fallback branch.
  label?: string
}

// Turns a saved graph (content.flow) into canvas nodes + connections with a
// simple left-to-right BFS layered layout, so reopening a branching flow
// shows the same shape it was saved in (not the single-message fallback).
function deserializeFlow(flow: { startNodeId: string; nodes: Record<string, any> }, trigger: Node): { nodes: Node[]; connections: Connection[] } {
  const graphNodes = flow.nodes || {}
  const canvasNodes: Node[] = [trigger]
  const canvasConnections: Connection[] = []
  const visited = new Set<string>()
  const depthOf: Record<string, number> = {}
  const queue: { id: string; depth: number }[] = flow.startNodeId ? [{ id: flow.startNodeId, depth: 0 }] : []

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (!id || visited.has(id)) continue
    visited.add(id)
    depthOf[id] = depth

    const gNode = graphNodes[id]
    if (!gNode) continue

    if (gNode.type === "message" && gNode.next) queue.push({ id: gNode.next, depth: depth + 1 })
    if (gNode.type === "condition") {
      for (const b of gNode.branches || []) if (b.next) queue.push({ id: b.next, depth: depth + 1 })
      if (gNode.default_next) queue.push({ id: gNode.default_next, depth: depth + 1 })
    }
  }

  const idsByDepth: Record<number, string[]> = {}
  for (const [id, depth] of Object.entries(depthOf)) {
    idsByDepth[depth] = idsByDepth[depth] || []
    idsByDepth[depth].push(id)
  }

  const COL_WIDTH = 280
  const ROW_HEIGHT = 170
  for (const [depthStr, ids] of Object.entries(idsByDepth)) {
    const depth = parseInt(depthStr)
    ids.forEach((id, i) => {
      const gNode = graphNodes[id]
      canvasNodes.push({
        id,
        type: gNode.type === "condition" ? "condition" : "message",
        x: 360 + depth * COL_WIDTH,
        y: 60 + i * ROW_HEIGHT,
        title: gNode.type === "condition" ? "Condition" : "Message",
        content: gNode.type === "message" ? gNode.text || "" : "",
        delaySeconds: gNode.type === "message" ? gNode.delay_seconds || 0 : undefined,
      })
    })
  }

  if (flow.startNodeId) {
    canvasConnections.push({ id: `c-t-${flow.startNodeId}`, fromId: trigger.id, toId: flow.startNodeId })
  }
  for (const [id, gNode] of Object.entries(graphNodes)) {
    if (gNode.type === "message" && gNode.next) {
      canvasConnections.push({ id: `c-${id}-${gNode.next}`, fromId: id, toId: gNode.next })
    }
    if (gNode.type === "condition") {
      for (const b of gNode.branches || []) {
        if (b.next) canvasConnections.push({ id: `c-${id}-${b.next}-${b.keyword}`, fromId: id, toId: b.next, label: b.keyword })
      }
      if (gNode.default_next) {
        canvasConnections.push({ id: `c-${id}-${gNode.default_next}-default`, fromId: id, toId: gNode.default_next })
      }
    }
  }

  return { nodes: canvasNodes, connections: canvasConnections }
}

// Turns canvas nodes + connections into the graph shape the webhook
// interpreter understands. Delay and Action nodes aren't stored as graph
// nodes themselves — a chain like message -> delay -> message folds the
// delay's seconds into the first message's delay_seconds, and Action nodes
// (tagging isn't wired up server-side yet) are skipped through silently.
function buildGraph(nodes: Node[], connections: Connection[], triggerId: string): { startNodeId: string | null; nodes: Record<string, any> } {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  function resolveNext(fromId: string, visited: Set<string> = new Set()): { nextId: string | null; delay: number } {
    if (visited.has(fromId)) return { nextId: null, delay: 0 } // cycle guard
    visited.add(fromId)
    const outgoing = connections.filter((c) => c.fromId === fromId)
    if (outgoing.length === 0) return { nextId: null, delay: 0 }
    const target = nodeById.get(outgoing[0].toId)
    if (!target) return { nextId: null, delay: 0 }
    if (target.type === "delay") {
      const d = parseInt(target.content) || 0
      const deeper = resolveNext(target.id, visited)
      return { nextId: deeper.nextId, delay: d + deeper.delay }
    }
    if (target.type === "action") {
      return resolveNext(target.id, visited)
    }
    return { nextId: target.id, delay: 0 }
  }

  const graphNodes: Record<string, any> = {}
  for (const node of nodes) {
    if (node.type === "message") {
      const { nextId, delay } = resolveNext(node.id)
      graphNodes[node.id] = {
        type: "message",
        text: node.content,
        delay_seconds: node.delaySeconds || delay || 0,
        next: nextId,
      }
    } else if (node.type === "condition") {
      const outgoing = connections.filter((c) => c.fromId === node.id)
      const branches: { keyword: string; next: string }[] = []
      let default_next: string | null = null
      for (const c of outgoing) {
        if (c.label && c.label.trim()) {
          branches.push({ keyword: c.label.trim(), next: c.toId })
        } else {
          default_next = c.toId
        }
      }
      graphNodes[node.id] = { type: "condition", branches, default_next }
    }
  }

  const { nextId: startNodeId } = resolveNext(triggerId)
  return { startNodeId, nodes: graphNodes }
}

export default function FlowBuilderPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <FlowBuilderContent />
    </Suspense>
  )
}

function FlowBuilderContent() {
  const { userId, isLoading: isSessionLoading } = useInstagramSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  const flowId = searchParams.get("id")

  // Demo fallback nodes
  const [nodes, setNodes] = useState<Node[]>([
    {
      id: "1",
      type: "trigger",
      x: 80,
      y: 180,
      title: "Keyword Trigger",
      content: "start",
      extra: "Trigger keyword"
    },
    {
      id: "2",
      type: "message",
      x: 420,
      y: 80,
      title: "Welcome DM",
      content: "Hey machan! Welcome to DMSpark! Smart automations are now active on your profile.",
      extra: "Auto-reply text"
    },
    {
      id: "3",
      type: "delay",
      x: 420,
      y: 280,
      title: "Smart Delay",
      content: "5",
      extra: "seconds"
    },
    {
      id: "4",
      type: "action",
      x: 760,
      y: 280,
      title: "Add Lead Tag",
      content: "Potential Client",
      extra: "SaaS CRM Tag"
    }
  ])

  // Demo fallback connections
  const [connections, setConnections] = useState<Connection[]>([
    { id: "c1", fromId: "1", toId: "2" },
    { id: "c2", fromId: "1", toId: "3" },
    { id: "c3", fromId: "3", toId: "4" }
  ])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("1")
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isSaved, setIsSaved] = useState(false)
  const [isLoadingFlow, setIsLoadingFlow] = useState(false)
  const [automationName, setAutomationName] = useState<string>("Demo Automation Flow")
  const [specificMediaId, setSpecificMediaId] = useState<string | null>(null)
  const [triggerSource, setTriggerSource] = useState<'comment' | 'dm' | 'story'>('dm')
  // The rule's original response_content, kept so saving can preserve fields
  // this canvas doesn't understand (e.g. sequence "steps" or lead-qual
  // "questions") instead of silently discarding them.
  const [originalContent, setOriginalContent] = useState<any>(null)
  // Manual connect mode: click a source node, then a target node, to link them.
  const [linkMode, setLinkMode] = useState(false)
  const [linkFromId, setLinkFromId] = useState<string | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!isSessionLoading && !isLoadingFlow) {
      const timer = setTimeout(() => setIsVisible(true), 100)
      return () => clearTimeout(timer)
    }
  }, [isSessionLoading, isLoadingFlow])

  // Find selected node
  const selectedNode = nodes.find(n => n.id === selectedNodeId)
  const outgoingFromSelected = selectedNodeId ? connections.filter(c => c.fromId === selectedNodeId) : []

  // Fetch automation if flowId is set in URL query parameters
  useEffect(() => {
    if (!userId || !flowId) return

    const loadAutomation = async () => {
      try {
        setIsLoadingFlow(true)
        const res = await fetch(`/api/automations?userId=${userId}`)
        const data = await res.json()
        if (res.ok && Array.isArray(data)) {
          const rule = data.find((r: any) => r.id === flowId)
          if (rule) {
            setAutomationName(rule.name)
            setSpecificMediaId(rule.specific_media_id)
            setTriggerSource(rule.trigger_source)
            setOriginalContent(rule.response_content || null)

            // Map database rule into nodes
            const triggerNode: Node = {
              id: "trigger-node",
              type: "trigger",
              x: 80,
              y: 180,
              title: rule.trigger_source === "comment" ? "Comment Trigger" : rule.trigger_source === "story" ? "Story Trigger" : "DM Keyword Trigger",
              content: rule.trigger_value || "start",
              extra: rule.trigger_type || "keyword"
            }

            const content = rule.response_content || {}

            if (content.flow?.nodes && content.flow?.startNodeId) {
              // Branching flow — reconstruct the full graph with auto-layout.
              const { nodes: loadedNodes, connections: loadedConnections } = deserializeFlow(content.flow, triggerNode)
              setNodes(loadedNodes)
              setConnections(loadedConnections)
              setSelectedNodeId("trigger-node")
              toast.success("Flow loaded successfully!")
              return
            }

            const isFollowGate = content.check_follow
            const delaySec = content.delay_seconds
            const responseMsg = content.message || content.card?.title || "Welcome to DMSpark!"

            const messageNode: Node = {
              id: "message-node",
              type: "message",
              x: (isFollowGate || delaySec) ? 640 : 360,
              y: 180,
              title: rule.name || "Auto-Reply Message",
              content: responseMsg,
              extra: content.card ? "Rich Card Reply" : "Simple Text Reply"
            }

            const newNodesList = [triggerNode, messageNode]
            const newConnectionsList: Connection[] = []

            if (isFollowGate && delaySec) {
              const followNode: Node = {
                id: "follow-check-node",
                type: "action",
                x: 360,
                y: 280,
                title: "Follower Check",
                content: "Followers Only Gate",
                extra: "Gate check active"
              }
              const delayNode: Node = {
                id: "delay-node",
                type: "delay",
                x: 360,
                y: 80,
                title: "Wait Delay",
                content: String(delaySec),
                extra: "seconds"
              }
              newNodesList.push(followNode, delayNode)
              newConnectionsList.push(
                { id: "c-t-f", fromId: "trigger-node", toId: "follow-check-node" },
                { id: "c-f-d", fromId: "follow-check-node", toId: "delay-node" },
                { id: "c-d-m", fromId: "delay-node", toId: "message-node" }
              )
            } else if (isFollowGate) {
              const followNode: Node = {
                id: "follow-check-node",
                type: "action",
                x: 360,
                y: 200,
                title: "Follower Check",
                content: "Followers Only Gate",
                extra: "Gate check active"
              }
              newNodesList.push(followNode)
              newConnectionsList.push(
                { id: "c-t-f", fromId: "trigger-node", toId: "follow-check-node" },
                { id: "c-f-m", fromId: "follow-check-node", toId: "message-node" }
              )
            } else if (delaySec) {
              const delayNode: Node = {
                id: "delay-node",
                type: "delay",
                x: 360,
                y: 200,
                title: "Wait Delay",
                content: String(delaySec),
                extra: "seconds"
              }
              newNodesList.push(delayNode)
              newConnectionsList.push(
                { id: "c-t-d", fromId: "trigger-node", toId: "delay-node" },
                { id: "c-d-m", fromId: "delay-node", toId: "message-node" }
              )
            } else {
              newConnectionsList.push(
                { id: "c-t-m", fromId: "trigger-node", toId: "message-node" }
              )
            }

            setNodes(newNodesList)
            setConnections(newConnectionsList)
            setSelectedNodeId("trigger-node")
            toast.success("Automation loaded successfully!")
          }
        }
      } catch (err) {
        console.error("Failed to load flow:", err)
        toast.error("Failed to load automation flow.")
      } finally {
        setIsLoadingFlow(false)
      }
    }

    loadAutomation()
  }, [userId, flowId])

  // Handle Drag Start
  const handleDragStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (linkMode) return // dragging is disabled while linking nodes
    const node = nodes.find(n => n.id === id)
    if (!node) return
    setDraggedNodeId(id)
    setSelectedNodeId(id)
    setDragOffset({
      x: e.clientX - node.x,
      y: e.clientY - node.y
    })
  }

  // Handle Drag Move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedNodeId) return
    e.preventDefault()

    setNodes(prevNodes =>
      prevNodes.map(node => {
        if (node.id === draggedNodeId) {
          // Clamp coordinates to keep inside canvas boundaries
          const newX = Math.max(20, Math.min(e.clientX - dragOffset.x, 1200))
          const newY = Math.max(20, Math.min(e.clientY - dragOffset.y, 650))
          return { ...node, x: newX, y: newY }
        }
        return node
      })
    )
  }

  // Handle Drag End
  const handleMouseUp = () => {
    setDraggedNodeId(null)
  }

  // Click on a node: either select it, or (in link mode) use it as the
  // source/target of a new manual connection.
  const handleNodeClick = (id: string) => {
    if (!linkMode) {
      setSelectedNodeId(id)
      return
    }
    if (!linkFromId) {
      setLinkFromId(id)
      return
    }
    if (linkFromId === id) {
      setLinkFromId(null) // clicked the same node twice — cancel
      return
    }
    setConnections(prev => [...prev, { id: `c_${Date.now()}`, fromId: linkFromId, toId: id }])
    setLinkFromId(null)
    setLinkMode(false)
    toast.success("Connected!")
  }

  // Add new Node
  const addNewNode = (type: "message" | "delay" | "action" | "condition") => {
    const id = `n_${Date.now()}`
    let title = ""
    let content = ""
    let extra = ""

    if (type === "message") {
      title = "New Reply"
      content = "Type your Instagram response message here..."
      extra = "Auto-reply text"
    } else if (type === "delay") {
      title = "Wait Delay"
      content = "10"
      extra = "seconds"
    } else if (type === "condition") {
      title = "Condition"
      content = ""
      extra = "Branches on the reply"
    } else {
      title = "Assign Tag"
      content = "Warm Lead"
      extra = "SaaS CRM Tag"
    }

    const newNode: Node = {
      id,
      type,
      x: 300 + Math.random() * 80,
      y: 200 + Math.random() * 80,
      title,
      content,
      extra,
      delaySeconds: type === "message" ? 0 : undefined,
    }

    setNodes([...nodes, newNode])
    setSelectedNodeId(id)

    // Try to auto-connect from selected node if exists
    if (selectedNodeId) {
      setConnections(prev => [...prev, {
        id: `c_${Date.now()}`,
        fromId: selectedNodeId,
        toId: id
      }])
    }
  }

  // Delete selected node
  const deleteSelectedNode = () => {
    if (!selectedNodeId) return
    setNodes(prev => prev.filter(n => n.id !== selectedNodeId))
    setConnections(prev => prev.filter(c => c.fromId !== selectedNodeId && c.toId !== selectedNodeId))
    setSelectedNodeId(null)
  }

  // Update selected node values from right sidebar
  const updateSelectedNode = (field: "title" | "content" | "extra" | "delaySeconds", value: string | number) => {
    if (!selectedNodeId) return
    setNodes(prev => prev.map(node => {
      if (node.id === selectedNodeId) {
        return { ...node, [field]: value }
      }
      return node
    }))
  }

  const updateConnectionLabel = (connId: string, label: string) => {
    setConnections(prev => prev.map(c => c.id === connId ? { ...c, label } : c))
  }

  const deleteConnection = (connId: string) => {
    setConnections(prev => prev.filter(c => c.id !== connId))
  }

  // Save changes to database API or locally
  const handleSave = async () => {
    if (isLoadingFlow) return

    // If editing a real database automation
    if (flowId && userId) {
      // Sequence ("steps") and Lead Qualification ("questions") automations
      // store data this canvas can't show — block saving instead of
      // silently discarding it.
      if (Array.isArray(originalContent?.steps) && originalContent.steps.length > 0) {
        toast.error("Can't edit here", {
          description: "This is a Message Sequence automation — its messages aren't editable in the visual builder yet. Delete and recreate it to change them.",
        })
        return
      }
      if (Array.isArray(originalContent?.questions) && originalContent.questions.length > 0) {
        toast.error("Can't edit here", {
          description: "This is a Lead Qualification automation — its questions aren't editable in the visual builder yet. Delete and recreate it to change them.",
        })
        return
      }

      try {
        setIsSaved(true)
        const triggerNode = nodes.find(n => n.type === "trigger")
        if (!triggerNode) {
          toast.error("Flow invalid", { description: "Your flow must have a Trigger node." })
          setIsSaved(false)
          return
        }

        const graph = buildGraph(nodes, connections, triggerNode.id)
        if (!graph.startNodeId) {
          toast.error("Flow invalid", { description: "Connect your trigger to at least one message." })
          setIsSaved(false)
          return
        }

        const isFollowGateActive = nodes.some(n => n.type === "action" && n.title === "Follower Check" && connections.some(c => c.toId === n.id || c.fromId === n.id))

        const res = await fetch("/api/automations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: flowId,
            name: automationName,
            trigger_source: triggerSource,
            trigger_value: triggerNode.content,
            content: {
              flow: { startNodeId: graph.startNodeId, nodes: graph.nodes },
              check_follow: isFollowGateActive,
            },
            specific_media_id: specificMediaId
          })
        })

        if (res.ok) {
          toast.success("Changes saved successfully!", { description: "Your live Instagram automation was updated." })
          setTimeout(() => router.push("/dashboard/automations"), 1200)
        } else {
          toast.error("Failed to save changes", { description: "Please check your database connectivity." })
        }
      } catch (err) {
        console.error("Save error:", err)
        toast.error("Network Error", { description: "Unable to reach server API." })
      } finally {
        setTimeout(() => setIsSaved(false), 2000)
      }
    } else {
      // Prototype visual local save feedback
      setIsSaved(true)
      toast.success("Prototype Flow saved locally!", { description: "Visual map changes stored in browser view state." })
      setTimeout(() => setIsSaved(false), 2000)
    }
  }

  if (isSessionLoading || isLoadingFlow) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">Loading Automation Canvas...</span>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 space-y-6 text-foreground min-h-[90vh] flex flex-col justify-between font-sans relative z-10 animate-in fade-in duration-500">


      {/* Top Header Utilities */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div>
          <div className="flex items-center gap-2">
            {flowId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/dashboard/automations")}
                className="h-8 w-8 hover:bg-secondary rounded-xl text-muted-foreground mr-1"
                title="Back to Automations"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <h1 className="text-3xl font-bold tracking-tight">
              {flowId ? `Edit: ${automationName}` : "Visual Flow Builder"}
            </h1>
          </div>
          <p className="text-muted-foreground mt-1">
            {flowId ? `Updating live rule: ${automationName} (${triggerSource} channel)` : "Design and map your Instagram DM conversational flows visually."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={isSaved}
            className="bg-primary hover:bg-primary/95 text-white font-bold rounded-xl px-4 py-2 flex items-center gap-2 cursor-pointer shadow-md shadow-primary/10 transition-all"
          >
            <Save className="w-4 h-4" /> {isSaved ? "Flow Saved!" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Builder Layout Workspace */}
      <div className={`flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch relative min-h-[580px] transition-all duration-700 delay-150 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

        {/* Left Side Visual Drag & Drop Canvas */}
        <div
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="lg:col-span-3 border border-border bg-card/40 backdrop-blur-sm rounded-3xl relative overflow-hidden select-none min-h-[500px] shadow-sm flex flex-col justify-between"
        >
          {/* Grid Background Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

          {/* Floating Canvas Dock / Toolbar */}
          <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between bg-card/85 backdrop-blur-lg px-4 py-3 rounded-2xl border border-border/80 shadow-md shadow-black/5 flex-wrap gap-3">
            <span className="text-xs font-extrabold text-foreground flex items-center gap-2 bg-gradient-to-r from-primary/10 to-indigo-500/10 border border-primary/20 px-3 py-1 rounded-full shadow-sm">
              <Compass className="w-4 h-4 text-primary animate-pulse" />
              <span className="bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">Flow Dock</span>
            </span>
            <div className="flex items-center gap-2.5 flex-wrap">
              <Button
                onClick={() => addNewNode("message")}
                size="sm"
                variant="outline"
                className="h-9 rounded-xl text-xs font-bold hover:bg-blue-500 hover:text-white hover:border-blue-500 border-blue-500/25 text-blue-500 transition-all duration-300 cursor-pointer flex items-center gap-1.5 bg-blue-500/5 shadow-sm shadow-blue-500/5 hover:shadow-blue-500/15"
              >
                <Plus className="w-3.5 h-3.5" /> Message
              </Button>
              <Button
                onClick={() => addNewNode("condition")}
                size="sm"
                variant="outline"
                className="h-9 rounded-xl text-xs font-bold hover:bg-rose-500 hover:text-white hover:border-rose-500 border-rose-500/25 text-rose-500 transition-all duration-300 cursor-pointer flex items-center gap-1.5 bg-rose-500/5 shadow-sm shadow-rose-500/5 hover:shadow-rose-500/15"
              >
                <Plus className="w-3.5 h-3.5" /> Condition
              </Button>
              <Button
                onClick={() => addNewNode("delay")}
                size="sm"
                variant="outline"
                className="h-9 rounded-xl text-xs font-bold hover:bg-amber-500 hover:text-white hover:border-amber-500 border-amber-500/25 text-amber-500 transition-all duration-300 cursor-pointer flex items-center gap-1.5 bg-amber-500/5 shadow-sm shadow-amber-500/5 hover:shadow-amber-500/15"
              >
                <Plus className="w-3.5 h-3.5" /> Delay
              </Button>
              <Button
                onClick={() => addNewNode("action")}
                size="sm"
                variant="outline"
                className="h-9 rounded-xl text-xs font-bold hover:bg-purple-500 hover:text-white hover:border-purple-500 border-purple-500/25 text-purple-500 transition-all duration-300 cursor-pointer flex items-center gap-1.5 bg-purple-500/5 shadow-sm shadow-purple-500/5 hover:shadow-purple-500/15"
              >
                <Plus className="w-3.5 h-3.5" /> Action
              </Button>
              <Button
                onClick={() => { setLinkMode(!linkMode); setLinkFromId(null) }}
                size="sm"
                variant={linkMode ? "default" : "outline"}
                className={`h-9 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
                  linkMode
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500"
                    : "hover:bg-emerald-500 hover:text-white hover:border-emerald-500 border-emerald-500/25 text-emerald-500 bg-emerald-500/5"
                }`}
              >
                <Link2 className="w-3.5 h-3.5" /> {linkMode ? (linkFromId ? "Click target node..." : "Click source node...") : "Connect"}
              </Button>
            </div>
          </div>

          {/* SVG Connections Overlay */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            <defs>
              <linearGradient id="wireGradient" x1="0%" y1="0%" x2="100%" y2="0%" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="oklch(0.58 0.16 260)" stopOpacity={0.8} />
                <stop offset="100%" stopColor="oklch(0.68 0.18 280)" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            {connections.map(c => {
              const fromNode = nodes.find(n => n.id === c.fromId)
              const toNode = nodes.find(n => n.id === c.toId)
              if (!fromNode || !toNode) return null

              // Calculate ports (fromNode right edge center, toNode left edge center)
              const startX = fromNode.x + 200 // node width is 200
              const startY = fromNode.y + 40  // node header height center
              const endX = toNode.x
              const endY = toNode.y + 40

              // Draw bezier curves
              const controlOffset = Math.abs(endX - startX) * 0.4
              const pathD = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`
              const midX = (startX + endX) / 2
              const midY = (startY + endY) / 2

              return (
                <g key={c.id}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={4}
                    opacity={0.3}
                  />
                  <path
                    d={pathD}
                    fill="none"
                    stroke={fromNode.type === "condition" ? "oklch(0.64 0.21 20)" : "url(#wireGradient)"}
                    strokeWidth={2.5}
                    className="transition-all"
                  />
                  {fromNode.type === "condition" && (
                    <>
                      <rect x={midX - 26} y={midY - 10} width={52} height={20} rx={6} fill="var(--card)" stroke="oklch(0.64 0.21 20)" strokeWidth={1} />
                      <text x={midX} y={midY + 4} textAnchor="middle" fontSize="9" fontWeight={800} fill="oklch(0.64 0.21 20)">
                        {c.label?.trim() ? c.label.trim().slice(0, 8) : "else"}
                      </text>
                    </>
                  )}
                  {/* Floating pulse circle along path */}
                  <circle r={3.5} fill="oklch(0.58 0.16 260)">
                    <animateMotion
                      dur="3.5s"
                      repeatCount="indefinite"
                      path={pathD}
                    />
                  </circle>
                </g>
              )
            })}
          </svg>

          {/* Render Draggable Nodes */}
          <div className="absolute inset-0 z-20 overflow-hidden">
            {nodes.map(node => {
              const isSelected = selectedNodeId === node.id
              const isLinkSource = linkMode && linkFromId === node.id
              let typeStyles = ""
              let iconElement = null

              if (node.type === "trigger") {
                typeStyles = "border-emerald-500/30 shadow-emerald-500/5 bg-emerald-500/5"
                iconElement = <Zap className="w-3.5 h-3.5 text-emerald-500" />
              } else if (node.type === "message") {
                typeStyles = "border-blue-500/30 shadow-blue-500/5 bg-blue-500/5"
                iconElement = <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
              } else if (node.type === "delay") {
                typeStyles = "border-amber-500/30 shadow-amber-500/5 bg-amber-500/5"
                iconElement = <Clock className="w-3.5 h-3.5 text-amber-500" />
              } else if (node.type === "condition") {
                typeStyles = "border-rose-500/30 shadow-rose-500/5 bg-rose-500/5"
                iconElement = <GitBranch className="w-3.5 h-3.5 text-rose-500" />
              } else if (node.type === "action") {
                typeStyles = "border-purple-500/30 shadow-purple-500/5 bg-purple-500/5"
                iconElement = <Sliders className="w-3.5 h-3.5 text-purple-500" />
              }

              return (
                <div
                  key={node.id}
                  style={{ left: node.x, top: node.y }}
                  onClick={(e) => { e.stopPropagation(); handleNodeClick(node.id) }}
                  className={`absolute w-[200px] bg-card rounded-2xl border ${
                    isLinkSource ? 'border-emerald-500 ring-2 ring-emerald-500/40' : isSelected ? 'border-primary shadow-lg ring-1 ring-primary/20' : 'border-border'
                  } shadow-sm transition-shadow duration-200 cursor-pointer overflow-hidden ${typeStyles}`}
                >
                  {/* Node Header (Drag Target) */}
                  <div
                    onMouseDown={(e) => handleDragStart(e, node.id)}
                    className={`px-3.5 py-2.5 border-b border-border/80 flex items-center justify-between select-none bg-secondary/30 ${linkMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {iconElement}
                      <span className="text-[10px] font-black tracking-tight text-foreground truncate uppercase">{node.title}</span>
                    </div>
                  </div>

                  {/* Node Content */}
                  <div className="p-3">
                    {node.type === "condition" ? (
                      <p className="text-[11px] text-muted-foreground leading-normal italic">
                        Branches on the reply — connect it to each possible message.
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground leading-normal line-clamp-3 font-medium italic">
                        "{node.content}"
                      </p>
                    )}
                    {node.type === "message" && !!node.delaySeconds && (
                      <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider block mt-2 text-right">
                        wait {node.delaySeconds}s first
                      </span>
                    )}
                    {node.extra && node.type !== "message" && (
                      <span className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wider block mt-2 text-right">
                        {node.extra}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Active Automation Detail Tag (Bottom-Left) */}
          <div className="absolute bottom-4 left-4 z-30 bg-card/85 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-border/80 text-[10px] font-black uppercase tracking-wider text-muted-foreground/80 shadow-sm flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span>Flow: {automationName} • {triggerSource.toUpperCase()} Channel</span>
          </div>
        </div>

        {/* Right Side Glassmorphic Configurer Panel */}
        <Card className="lg:col-span-1 p-5 bg-card/60 border-border shadow-sm flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            <h3 className="font-extrabold text-foreground text-sm tracking-tight border-b border-border/50 pb-2.5 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" /> Node Properties
            </h3>

            {selectedNode ? (
              <div className="space-y-4">
                {/* Node Title input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Node Label</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                      <Sliders className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      value={selectedNode.title}
                      onChange={(e) => updateSelectedNode("title", e.target.value)}
                      className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-xs font-semibold outline-none focus:border-primary/60 transition-colors"
                    />
                  </div>
                </div>

                {/* Node Content text area — not shown for condition nodes, which have no message of their own */}
                {selectedNode.type !== "condition" && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">
                      {selectedNode.type === "trigger" ? "Trigger Word / Keywords" : selectedNode.type === "delay" ? "Delay Time (seconds)" : "Message / Tag Content"}
                    </label>
                    <textarea
                      rows={4}
                      value={selectedNode.content}
                      onChange={(e) => updateSelectedNode("content", e.target.value)}
                      className="w-full p-3 rounded-xl border border-border bg-background text-xs font-semibold outline-none focus:border-primary/60 transition-colors resize-none leading-relaxed"
                    />
                  </div>
                )}

                {/* Delay before sending — message nodes only */}
                {selectedNode.type === "message" && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Wait before sending (seconds)</label>
                    <input
                      type="number"
                      min={0}
                      value={selectedNode.delaySeconds ?? 0}
                      onChange={(e) => updateSelectedNode("delaySeconds", Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-semibold outline-none focus:border-primary/60 transition-colors"
                    />
                  </div>
                )}

                {/* Branches list — condition nodes only */}
                {selectedNode.type === "condition" && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">
                      Branches ({outgoingFromSelected.length})
                    </label>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Use "Connect" in the dock to link this to each possible next message, then type the keyword that routes there. Leave one blank as the fallback ("else").
                    </p>
                    {outgoingFromSelected.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic py-3 text-center border border-dashed border-border rounded-xl">
                        No branches yet — use Connect.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {outgoingFromSelected.map((c) => {
                          const target = nodes.find(n => n.id === c.toId)
                          return (
                            <div key={c.id} className="p-2.5 rounded-xl border border-border bg-secondary/30 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-foreground truncate">→ {target?.title || "?"}</span>
                                <button
                                  onClick={() => deleteConnection(c.id)}
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={c.label || ""}
                                onChange={(e) => updateConnectionLabel(c.id, e.target.value)}
                                placeholder="keyword (blank = else/fallback)"
                                className="w-full h-8 px-2 rounded-lg border border-border bg-background text-[11px] font-mono outline-none focus:border-primary/60"
                              />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Optional description label */}
                {selectedNode.type !== "condition" && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Subtext Label</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                        <Info className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        value={selectedNode.extra || ""}
                        onChange={(e) => updateSelectedNode("extra", e.target.value)}
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background text-xs font-semibold outline-none focus:border-primary/60 transition-colors"
                      />
                    </div>
                  </div>
                )}

                {/* Node details alert info */}
                <div className="bg-secondary/40 border border-border p-3 rounded-xl flex gap-2">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">Node Guide</p>
                    <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
                      {selectedNode.type === 'trigger'
                        ? `Fires when the keyword matches "${selectedNode.content}".`
                        : selectedNode.type === 'condition'
                          ? 'Pauses the flow and waits for the person\'s reply, then routes to the matching branch.'
                          : 'This node runs when the flow reaches this point.'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-24 text-center text-muted-foreground text-xs border border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-2">
                <Maximize2 className="w-5 h-5 opacity-40 animate-pulse" />
                <span>Select a node inside the canvas to edit its properties.</span>
              </div>
            )}
          </div>

          {/* Delete Node Container */}
          {selectedNodeId && selectedNode?.type !== "trigger" && selectedNode?.id !== "message-node" && (
            <div className="pt-4 border-t border-border mt-6">
              <Button
                onClick={deleteSelectedNode}
                variant="ghost"
                className="w-full h-10 rounded-xl hover:bg-destructive/10 text-destructive hover:text-destructive font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Trash2 className="w-4 h-4" /> Delete Selected Node
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
