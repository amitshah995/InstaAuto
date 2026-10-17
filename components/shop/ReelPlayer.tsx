"use client"

import { useState } from "react"

/**
 * Plays the creator's own reel right on this page, so the visitor stays here.
 * Only if the video address has expired or fails to load does it fall back to a still image with a link.
 */
export default function ReelPlayer({ src, poster, watchHref }: { src: string; poster: string | null; watchHref: string | null }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="relative grid aspect-[9/16] max-h-[640px] w-full place-items-center bg-black">
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        )}
        <p className="relative px-6 text-center text-sm text-white">
          This video could not be loaded.
          {watchHref && (
            <>
              {" "}
              <a href={watchHref} target="_blank" rel="noopener noreferrer" className="font-bold underline">Watch it on Instagram</a>
            </>
          )}
        </p>
      </div>
    )
  }
  return (
    <video
      src={src}
      poster={poster ?? undefined}
      controls
      playsInline
      preload="metadata"
      controlsList="nodownload"
      onError={() => setFailed(true)}
      className="block aspect-[9/16] max-h-[640px] w-full bg-black object-cover"
    />
  )
}
