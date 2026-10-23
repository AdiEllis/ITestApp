"use client";
import { forwardRef, useRef, useState } from "react";

/**
 * <audio> for recordings and question audio.
 * - MediaRecorder WebM files carry no duration header, so Chrome shows 0:00 / Infinity until
 *   played; seeking far ahead once forces the real duration.
 * - /api/media/... redirects to a signed link that expires. A phone that was in another app for a
 *   while comes back to a dead link and shows an error; reload a fresh link and keep the position.
 */
export const RecordingAudio = forwardRef<HTMLAudioElement, React.AudioHTMLAttributes<HTMLAudioElement>>(function RecordingAudio(props, ref) {
  const [fresh, setFresh] = useState(0);
  const resume = useRef<number | null>(null);
  const lastRetry = useRef(0);
  const base = typeof props.src === "string" ? props.src : undefined;
  const refreshable = !!base && base.startsWith("/api/media/");
  const src = refreshable && fresh ? `${base}${base!.includes("?") ? "&" : "?"}r=${fresh}` : props.src;
  return (
    <audio
      ref={ref}
      controls
      preload="metadata"
      {...props}
      src={src}
      onError={(e) => {
        const a = e.currentTarget;
        // At most one retry every few seconds, so a file that is really gone doesn't loop.
        if (refreshable && Date.now() - lastRetry.current > 5000) {
          lastRetry.current = Date.now();
          resume.current = a.currentTime || null;
          setFresh(Date.now());
          return;
        }
        props.onError?.(e);
      }}
      onLoadedMetadata={(e) => {
        const a = e.currentTarget;
        if (resume.current !== null) {
          a.currentTime = resume.current;
          resume.current = null;
        } else if (a.duration === Infinity || Number.isNaN(a.duration)) {
          const reset = () => {
            a.removeEventListener("durationchange", reset);
            a.currentTime = 0;
          };
          a.addEventListener("durationchange", reset);
          a.currentTime = 1e7;
        }
        props.onLoadedMetadata?.(e);
      }}
    />
  );
});
