import { forwardRef } from "react";

/**
 * <audio> for browser-made recordings. MediaRecorder WebM files carry no duration header, so
 * Chrome shows 0:00 / Infinity until played; seeking far ahead once forces the real duration.
 */
export const RecordingAudio = forwardRef<HTMLAudioElement, React.AudioHTMLAttributes<HTMLAudioElement>>(function RecordingAudio(props, ref) {
  return (
    <audio
      ref={ref}
      controls
      preload="metadata"
      {...props}
      onLoadedMetadata={(e) => {
        const a = e.currentTarget;
        if (a.duration === Infinity || Number.isNaN(a.duration)) {
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
