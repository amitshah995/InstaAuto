import type { ComponentType } from "react"
import { CommentToDmCalculator, CreatorPricingCalculator, DmRoiCalculator, EngagementCalculator } from "./calculators"
import { CaptionChecker, CarouselTextSplitter, HookChecker, InstagramImageSizes, ReelBeatSheet } from "./content-tools"
import { ChatLinkGenerator, DmTemplates } from "./messaging-tools"
import { HashtagGenerator, TopHashtags } from "./hashtag-tools"
import { CaptionFormatter, FancyFontsGenerator, GiveawayPicker } from "./text-tools"

export const TOOL_COMPONENTS: Record<string, ComponentType> = {
  "engagement-calculator": EngagementCalculator,
  "comment-to-dm-calculator": CommentToDmCalculator,
  "dm-roi-calculator": DmRoiCalculator,
  "chat-link-generator": ChatLinkGenerator,
  "caption-checker": CaptionChecker,
  "hook-checker": HookChecker,
  "reel-beat-sheet": ReelBeatSheet,
  "dm-templates": DmTemplates,
  "creator-pricing-calculator": CreatorPricingCalculator,
  "fancy-fonts-generator": FancyFontsGenerator,
  "caption-formatter": CaptionFormatter,
  "giveaway-picker": GiveawayPicker,
  "carousel-text-splitter": CarouselTextSplitter,
  "instagram-image-sizes": InstagramImageSizes,
  "top-instagram-hashtags": TopHashtags,
  "instagram-hashtag-generator": HashtagGenerator,
}
