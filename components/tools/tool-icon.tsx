import { Heart, MessageCircle, Calculator, Link2, FileText, Zap, Clapperboard, MessagesSquare, IndianRupee, Type, AlignLeft, Gift, Layers, Ruler, Wrench, type LucideIcon } from "lucide-react"

const ICONS: Record<string, LucideIcon> = { Heart, MessageCircle, Calculator, Link2, FileText, Zap, Clapperboard, MessagesSquare, IndianRupee, Type, AlignLeft, Gift, Layers, Ruler }

export function ToolIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Wrench
  return <Icon size={size} />
}
