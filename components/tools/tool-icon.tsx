import { Heart, MessageCircle, Calculator, Link2, FileText, Zap, Clapperboard, MessagesSquare, IndianRupee, Type, AlignLeft, Gift, Layers, Ruler, Hash, Wrench, type LucideIcon } from "lucide-react"

const ICONS: Record<string, LucideIcon> = { Heart, MessageCircle, Calculator, Link2, FileText, Zap, Clapperboard, MessagesSquare, IndianRupee, Type, AlignLeft, Gift, Layers, Ruler, Hash }

export function ToolIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Wrench
  return <Icon size={size} />
}
