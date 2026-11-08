import { CelraLogo } from "@/components/ui/celra-logo"

export default function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="Loading">
      <CelraLogo variant="mark" size={40} className="celra-dot" />
    </div>
  )
}
