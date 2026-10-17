import { Bricolage_Grotesque } from "next/font/google"

// Used only for creator names and headings on the public shop pages; body text keeps the app font.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-shop-display", display: "swap" })

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <div className={display.variable}>{children}</div>
}
