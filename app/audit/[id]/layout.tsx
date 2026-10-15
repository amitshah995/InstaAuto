import type { Metadata } from "next"

// Result pages are personal and must not be indexed.
export const metadata: Metadata = {
  title: "Your Instagram audit",
  robots: { index: false, follow: false },
}

export default function AuditResultLayout({ children }: { children: React.ReactNode }) {
  return children
}
