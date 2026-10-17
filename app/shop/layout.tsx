import { Bricolage_Grotesque } from "next/font/google"

// Used only for creator names and headings on the public shop pages; body text keeps the app font.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-shop-display", display: "swap" })

// A bright, Instagram-style look for the public pages. It re-maps the colour tokens inside .shop-theme only, so the
// dashboard is untouched. All motion is switched off for visitors who ask for reduced motion.
const css = `
.shop-theme{--background:#fff7fb;--foreground:#1d1033;--card:#ffffff;--card-foreground:#1d1033;--muted:#f8ecfa;--muted-foreground:#6c5a86;--border:#ecd9f4;--primary:#c42bb0;--primary-foreground:#fff;
  --ig:linear-gradient(115deg,#feda75 0%,#fa7e1e 22%,#d62976 48%,#962fbf 74%,#4f5bd5 100%);
  position:relative;isolation:isolate;min-height:100vh;color:var(--foreground);background:var(--background)}
.shop-bg{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;
  background:radial-gradient(60rem 40rem at 10% -10%,#ffd9ec 0%,transparent 60%),radial-gradient(50rem 36rem at 100% 0%,#e4dcff 0%,transparent 60%),radial-gradient(50rem 40rem at 50% 110%,#ffe9c7 0%,transparent 60%),#fff7fb}
.shop-bg i{position:absolute;border-radius:9999px;filter:blur(70px);opacity:.85;animation:shop-float 18s ease-in-out infinite}
.shop-bg i:nth-child(1){width:26rem;height:26rem;left:-8rem;top:12%;background:#ff5fa8}
.shop-bg i:nth-child(2){width:24rem;height:24rem;right:-6rem;top:32%;background:#8a75ff;animation-delay:-6s}
.shop-bg i:nth-child(3){width:22rem;height:22rem;left:30%;bottom:-8rem;background:#ffb347;animation-delay:-11s}
.shop-bg b{position:absolute;inset:0;background-image:radial-gradient(#fff 1.2px,transparent 1.6px),radial-gradient(#fff 1px,transparent 1.4px);background-size:90px 90px,140px 140px;background-position:0 0,45px 60px;opacity:.9;animation:shop-twinkle 5s ease-in-out infinite}
.shop-bg u{position:absolute;inset:-20%;background:linear-gradient(105deg,transparent 42%,rgba(255,255,255,.55) 50%,transparent 58%);transform:translateX(-60%);animation:shop-sweep 9s ease-in-out infinite}
.shop-band{background:var(--ig);background-size:300% 100%;animation:shop-flow 12s ease-in-out infinite;position:relative;overflow:hidden}
.shop-band::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.5) 50%,transparent 60%);transform:translateX(-100%);animation:shop-sweep 6s ease-in-out infinite}
.shop-story{background:conic-gradient(from 210deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5,#feda75);padding:4px;border-radius:9999px;animation:shop-spin 14s linear infinite}
.shop-story>*{animation:shop-spin 14s linear infinite reverse}
.shop-name{background:var(--ig);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shop-flow 12s ease-in-out infinite}
.shop-ring{background:linear-gradient(135deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5);padding:2px;box-shadow:0 10px 30px -12px rgba(150,47,191,.45)}
.shop-pill{background:var(--ig);background-size:300% 100%;color:#fff;animation:shop-flow 10s ease-in-out infinite}
.shop-btn{position:relative;overflow:hidden;background:var(--ig);background-size:300% 100%;color:#fff;animation:shop-flow 10s ease-in-out infinite}
.shop-btn::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.55) 50%,transparent 60%);transform:translateX(-120%);animation:shop-sweep 4.5s ease-in-out infinite}
.shop-price{background:linear-gradient(90deg,#d62976,#962fbf,#4f5bd5);-webkit-background-clip:text;background-clip:text;color:transparent}
.shop-tag{background:linear-gradient(90deg,#d62976,#4f5bd5);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:600}
@keyframes shop-flow{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@keyframes shop-float{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(3rem,-2.5rem) scale(1.12)}}
@keyframes shop-twinkle{0%,100%{opacity:.35}50%{opacity:.85}}
@keyframes shop-sweep{0%{transform:translateX(-120%)}55%,100%{transform:translateX(120%)}}
@keyframes shop-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.shop-bg i,.shop-bg b,.shop-bg u,.shop-band,.shop-band::after,.shop-story,.shop-story>*,.shop-name,.shop-pill,.shop-btn,.shop-btn::after{animation:none!important}}
`

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} shop-theme`}>
      <style>{css}</style>
      <div className="shop-bg" aria-hidden>
        <i />
        <i />
        <i />
        <b />
        <u />
      </div>
      {children}
    </div>
  )
}
