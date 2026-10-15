"use client"

import { useState } from "react"
import { TrendingDown, TrendingUp } from "lucide-react"
import { commentToDm, dmRoi, engagement, influencerRates, NICHES } from "@/lib/tools/calc"
import { toolBySlug } from "@/lib/tools/registry"
import { LeadCapture } from "./lead-capture"
import { inr, int, NumField, Panel, SelectField, Tile, toNum } from "./ui"

const offer = (slug: string) => toolBySlug(slug)!.offer
const Lead = ({ slug, context }: { slug: string; context: string }) => {
  const o = offer(slug)
  return <LeadCapture tool={slug} context={context} headline={o.headline} text={o.text} button={o.button} />
}
const grid2 = "au-grid2"

// ------------------------------------------------------------------ engagement
export function EngagementCalculator() {
  const [v, setV] = useState({ followers: "10000", likes: "300", comments: "20", saves: "", shares: "" })
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x })
  const r = engagement({ followers: toNum(v.followers), likes: toNum(v.likes), comments: toNum(v.comments), saves: toNum(v.saves), shares: toNum(v.shares) })
  const verdict = { low: ["Needs work", "#ff3b52"], below: ["Below target", "#f5b301"], good: ["Good", "#3ddc6b"], excellent: ["Excellent", "#3ddc6b"] } as const
  const [vl, vc] = r.level ? verdict[r.level] : ["Enter your numbers", "#9a9aa6"]
  return (
    <>
      <Panel title="Your numbers">
        <div className={grid2}>
          <NumField id="eng-f" label="Followers" value={v.followers} onChange={set("followers")} />
          <NumField id="eng-l" label="Average likes per post" value={v.likes} onChange={set("likes")} />
          <NumField id="eng-c" label="Average comments per post" value={v.comments} onChange={set("comments")} />
          <NumField id="eng-s" label="Average saves per post (optional)" value={v.saves} onChange={set("saves")} />
          <NumField id="eng-sh" label="Average shares per post (optional)" value={v.shares} onChange={set("shares")} />
        </div>
      </Panel>
      <Panel title="Your result">
        <div className="au-stats">
          <Tile label="Engagement rate" value={r.erPct === null ? "-" : `${r.erPct}%`} color={vc} />
          <Tile label="Working target" value={`${r.targetPct}%`} sub={`${r.tier.label} (${r.tier.range})`} />
          <Tile label="Status" value={vl} color={vc} />
          <Tile label="Interactions / post" value={int(r.interactions)} />
        </div>
        {r.erPct !== null && r.level && (
          <p className="au-muted" style={{ fontSize: 14 }}>
            {r.level === "low" || r.level === "below"
              ? <><TrendingDown size={14} style={{ display: "inline", marginRight: 6 }} />To reach the working target you would need about <b style={{ color: "#fff" }}>{int(r.neededPerPost)}</b> interactions per post.</>
              : <><TrendingUp size={14} style={{ display: "inline", marginRight: 6 }} />You are at or above the working target for accounts your size. Keep doing what works.</>}
          </p>
        )}
        <p className="au-muted" style={{ fontSize: 12 }}>The target is a working guide for accounts of your size, not an official Instagram benchmark.</p>
      </Panel>
      <Lead slug="engagement-calculator" context={`ER ${r.erPct ?? "-"}% | ${int(r.followers)} followers | target ${r.targetPct}%`} />
    </>
  )
}

// ------------------------------------------------------------------ comment to DM
export function CommentToDmCalculator() {
  const [v, setV] = useState({ posts: "12", comments: "50", intent: "30", manual: "25", auto: "95", open: "60", click: "30", conv: "10", value: "1000" })
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x })
  const r = commentToDm({ postsPerMonth: toNum(v.posts), avgComments: toNum(v.comments), intentPct: toNum(v.intent), manualReplyPct: toNum(v.manual), autoReplyPct: toNum(v.auto), openPct: toNum(v.open), clickPct: toNum(v.click), convPct: toNum(v.conv), valuePerSale: toNum(v.value) })
  return (
    <>
      <Panel title="Your account">
        <div className={grid2}>
          <NumField id="c-p" label="Posts per month" value={v.posts} onChange={set("posts")} />
          <NumField id="c-c" label="Average comments per post" value={v.comments} onChange={set("comments")} />
          <NumField id="c-v" label="Value of one sale or lead" value={v.value} onChange={set("value")} prefix={"₹"} />
        </div>
      </Panel>
      <Panel title="Assumptions (edit to match your account)">
        <div className={grid2}>
          <NumField id="c-i" label="Comments that ask for a link, price or info" value={v.intent} onChange={set("intent")} suffix="%" />
          <NumField id="c-m" label="Of those, how many you answer by hand in time" value={v.manual} onChange={set("manual")} suffix="%" hint="Late answers lose the buyer." />
          <NumField id="c-a" label="Of those, how many get an automatic reply" value={v.auto} onChange={set("auto")} suffix="%" />
          <NumField id="c-o" label="People who open and read the DM" value={v.open} onChange={set("open")} suffix="%" />
          <NumField id="c-k" label="Readers who click your link" value={v.click} onChange={set("click")} suffix="%" />
          <NumField id="c-s" label="Clicks that become a sale or lead" value={v.conv} onChange={set("conv")} suffix="%" />
        </div>
      </Panel>
      <Panel title="Your monthly estimate">
        <div className="au-stats">
          <Tile label="Buying comments" value={int(r.intentComments)} />
          <Tile label="DMs sent by hand" value={int(r.manual.dms)} />
          <Tile label="DMs sent automatically" value={int(r.auto.dms)} color="#ff6e80" />
          <Tile label="Extra sales" value={r.extraSales} color="#3ddc6b" />
        </div>
        <div className="au-grid2">
          <div className="au-tile"><p className="au-muted" style={{ fontSize: 13 }}>Revenue by hand</p><b className="au-head" style={{ fontSize: 24 }}>{inr(r.manual.revenue)}</b></div>
          <div className="au-tile"><p className="au-muted" style={{ fontSize: 13 }}>Revenue with automatic replies</p><b className="au-head" style={{ fontSize: 24, color: "#3ddc6b" }}>{inr(r.auto.revenue)}</b></div>
        </div>
        <p style={{ fontSize: 15 }}>Possible extra revenue: <b className="au-head" style={{ color: "#3ddc6b", fontSize: 20 }}>{inr(Math.max(0, r.extraRevenue))}</b> per month.</p>
        <p className="au-muted" style={{ fontSize: 12 }}>These are estimates from the assumptions above, not a promise of results.</p>
      </Panel>
      <Lead slug="comment-to-dm-calculator" context={`${v.posts} posts/mo, ${v.comments} comments/post | extra revenue ${inr(Math.max(0, r.extraRevenue))}/mo`} />
    </>
  )
}

// ------------------------------------------------------------------ DM ROI
export function DmRoiCalculator() {
  const [v, setV] = useState({ dms: "40", min: "3", hourly: "200", auto: "60", tool: "1000", extra: "2", aov: "1500" })
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x })
  const r = dmRoi({ dmsPerDay: toNum(v.dms), minutesPerDm: toNum(v.min), hourlyCost: toNum(v.hourly), automatablePct: toNum(v.auto), toolCost: toNum(v.tool), extraSales: toNum(v.extra), orderValue: toNum(v.aov) })
  return (
    <>
      <Panel title="Your inbox">
        <div className={grid2}>
          <NumField id="r-d" label="DMs you get per day" value={v.dms} onChange={set("dms")} />
          <NumField id="r-m" label="Minutes to answer one DM" value={v.min} onChange={set("min")} />
          <NumField id="r-h" label="Value of your time per hour" value={v.hourly} onChange={set("hourly")} prefix={"₹"} />
          <NumField id="r-a" label="DMs that repeat and can be automated" value={v.auto} onChange={set("auto")} suffix="%" hint="Price, location, links, order status." />
        </div>
      </Panel>
      <Panel title="Tool and extra sales">
        <div className={grid2}>
          <NumField id="r-t" label="Automation tool cost per month" value={v.tool} onChange={set("tool")} prefix={"₹"} />
          <NumField id="r-e" label="Extra sales per month from faster replies" value={v.extra} onChange={set("extra")} hint="Leave 0 if unsure." />
          <NumField id="r-o" label="Average order value" value={v.aov} onChange={set("aov")} prefix={"₹"} />
        </div>
      </Panel>
      <Panel title="Your monthly result">
        <div className="au-stats">
          <Tile label="Hours saved" value={r.hoursSaved} color="#ff6e80" />
          <Tile label="Time value saved" value={inr(r.timeValue)} />
          <Tile label="Net gain after tool cost" value={inr(r.net)} color={r.net >= 0 ? "#3ddc6b" : "#ff3b52"} />
          <Tile label="Return on tool cost" value={r.roi === null ? "-" : `${r.roi}x`} color="#f5b301" sub={r.paybackDays ? `Pays back in ~${r.paybackDays} days` : undefined} />
        </div>
        <p className="au-muted" style={{ fontSize: 12 }}>Estimates from the numbers you entered. Net gain = time value + extra sales - tool cost.</p>
      </Panel>
      <Lead slug="dm-roi-calculator" context={`${v.dms} DMs/day | ${r.hoursSaved} h saved | net ${inr(r.net)}`} />
    </>
  )
}

// ------------------------------------------------------------------ influencer pricing
export function CreatorPricingCalculator() {
  const [v, setV] = useState({ followers: "25000", er: "3", niche: "Fashion" })
  const rates = influencerRates({ followers: toNum(v.followers), erPct: toNum(v.er), niche: v.niche })
  return (
    <>
      <Panel title="Your account">
        <div className={grid2}>
          <NumField id="p-f" label="Followers" value={v.followers} onChange={(x) => setV({ ...v, followers: x })} />
          <NumField id="p-e" label="Engagement rate" value={v.er} onChange={(x) => setV({ ...v, er: x })} suffix="%" hint="Not sure? Use the engagement rate calculator." />
          <SelectField id="p-n" label="Niche" value={v.niche} onChange={(x) => setV({ ...v, niche: x })} options={Object.keys(NICHES).map((n) => ({ value: n, label: n }))} />
        </div>
      </Panel>
      <Panel title="Rough price range per deliverable">
        <div className="au-stats">
          {rates.map((r) => <Tile key={r.id} label={r.label} value={toNum(v.followers) ? `${inr(r.low)} - ${inr(r.high)}` : "-"} />)}
        </div>
        <p className="au-muted" style={{ fontSize: 12 }}>A starting range from simple rules (followers, engagement, niche and format). Your real rate depends on your audience, results and the brand.</p>
      </Panel>
      <Lead slug="creator-pricing-calculator" context={`${v.followers} followers | ER ${v.er}% | ${v.niche} | reel ${inr(rates[2].low)}-${inr(rates[2].high)}`} />
    </>
  )
}
