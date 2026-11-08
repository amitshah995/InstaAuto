import { cn } from "@/lib/utils"
import { BRAND_NAME } from "@/lib/site"

/**
 * Celra logo. The mark is a letter C drawn as a chat bubble (tail at the bottom-left)
 * with a coral dot in the opening: the reply that has just been sent.
 * The wordmark is outlined (Outfit Bold, SIL OFL) so it never depends on a loaded font.
 * Wordmark colour follows currentColor, so it works on light and dark.
 */
const WORD =
  "M403 11Q324 11 256.5 -16.5Q189 -44 138.5 -94Q88 -144 60 -210.5Q32 -277 32 -354Q32 -431 60 -497.5Q88 -564 138 -613Q188 -662 255.5 -689.5Q323 -717 402 -717Q486 -717 551.5 -690Q617 -663 666 -616L561 -510Q533 -540 493.5 -557Q454 -574 402 -574Q356 -574 317.5 -558.5Q279 -543 251.5 -514Q224 -485 208.5 -444Q193 -403 193 -354Q193 -304 208.5 -263Q224 -222 251.5 -193Q279 -164 317.5 -148Q356 -132 402 -132Q456 -132 496 -149Q536 -166 565 -196L671 -90Q620 -43 554.5 -16Q489 11 403 11ZM983 11Q904 11 842.5 -21.5Q781 -54 746 -112Q711 -170 711 -243Q711 -316 745.5 -373.5Q780 -431 839 -464Q898 -497 972 -497Q1044 -497 1099 -466Q1154 -435 1185.5 -380Q1217 -325 1217 -254Q1217 -241 1215.5 -226.5Q1214 -212 1210 -193L791 -192V-297L1145 -298L1079 -254Q1078 -296 1066 -323.5Q1054 -351 1030.5 -365.5Q1007 -380 973 -380Q937 -380 910.5 -363.5Q884 -347 869.5 -317Q855 -287 855 -244Q855 -201 870.5 -170.5Q886 -140 914.5 -123.5Q943 -107 982 -107Q1018 -107 1047 -119.5Q1076 -132 1098 -157L1182 -73Q1146 -31 1095 -10Q1044 11 983 11ZM1291 0V-726H1444V0ZM1552 0V-486H1705V0ZM1705 -267 1641 -317Q1660 -402 1705 -449Q1750 -496 1830 -496Q1865 -496 1891.5 -485.5Q1918 -475 1938 -453L1847 -338Q1837 -349 1822 -355Q1807 -361 1788 -361Q1750 -361 1727.5 -337.5Q1705 -314 1705 -267ZM2199 10Q2132 10 2079.5 -23Q2027 -56 1996.5 -113Q1966 -170 1966 -243Q1966 -316 1996.5 -373Q2027 -430 2079.5 -463Q2132 -496 2199 -496Q2248 -496 2287.5 -477Q2327 -458 2352 -424.5Q2377 -391 2380 -348V-138Q2377 -95 2352.5 -61.5Q2328 -28 2288 -9Q2248 10 2199 10ZM2230 -128Q2279 -128 2309 -160.5Q2339 -193 2339 -243Q2339 -277 2325.5 -303Q2312 -329 2287.5 -343.5Q2263 -358 2231 -358Q2199 -358 2174.5 -343.5Q2150 -329 2135.5 -303Q2121 -277 2121 -243Q2121 -210 2135 -184Q2149 -158 2174 -143Q2199 -128 2230 -128ZM2333 0V-131L2356 -249L2333 -367V-486H2483V0Z"

export function CelraLogo({
  size = 32,
  variant = "full",
  className,
  title = BRAND_NAME,
}: {
  /** Height in px (the mark is square, the full logo is 186:64). */
  size?: number
  variant?: "mark" | "full"
  className?: string
  title?: string
}) {
  const full = variant === "full"
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={full ? "0 0 186 64" : "0 0 64 64"}
      height={size}
      width={full ? (size * 186) / 64 : size}
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      <rect width="64" height="64" rx="15" fill="#0B5C6E" />
      <path
        d="M43.5 20.4A15 15 0 1 0 43.5 39.6"
        stroke="#fff"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M21 41L16 51L27 46Z" fill="#fff" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="46.5" cy="30" r="4.4" fill="#FF6F4D" />
      {full && <path fill="currentColor" transform="translate(78 47) scale(0.0425)" d={WORD} />}
    </svg>
  )
}
