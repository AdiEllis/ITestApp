"use client";
import { useRef, useState } from "react";
import { Lock } from "lucide-react";
import { mediaCategory } from "@/lib/files";

/**
 * Audio/video stimulus with an optional play limit. Each playback from the beginning counts as one play.
 * The count is reported to the server so it survives reloads.
 */
export function LimitedMedia({
  src,
  mimeType,
  limit,
  used,
  onPlay,
  label,
  autoPlay = false,
}: {
  src: string;
  mimeType: string;
  limit: number | null;
  used: number;
  /** returns false if the server refused the play */
  onPlay: () => Promise<boolean>;
  label: string;
  /** Start playing when shown (only if no play was used yet). */
  autoPlay?: boolean;
}) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const [count, setCount] = useState(used);
  // Locked once the last allowed play has ended (not while it is still playing or paused).
  const [blocked, setBlocked] = useState(limit !== null && used >= limit);
  const countingRef = useRef(false);
  const isVideo = mediaCategory(mimeType) === "video";

  async function handlePlay() {
    const el = ref.current;
    if (!el || countingRef.current) return;
    // Only a play from (near) the beginning counts; resuming after pause does not.
    if (el.currentTime > 1 && !el.ended) return;
    if (limit !== null && count >= limit) {
      el.pause();
      setBlocked(true);
      return;
    }
    countingRef.current = true;
    const ok = await onPlay();
    countingRef.current = false;
    if (!ok) {
      el.pause();
      setBlocked(true);
      return;
    }
    setCount((c) => c + 1);
  }

  const common = {
    src,
    controls: true,
    preload: "metadata" as const,
    autoPlay: autoPlay && used === 0 && (limit === null || limit > 0),
    controlsList: "nodownload noplaybackrate",
    onPlay: handlePlay,
    onEnded: () => limit !== null && count >= limit && setBlocked(true),
    "aria-label": label,
  };

  return (
    <div className="space-y-1.5">
      {blocked ? (
        <div className="flex items-center gap-2 rounded-lg border border-line bg-subtle px-3 py-3 text-sm text-ink-2">
          <Lock className="size-4" /> ניצלת את מספר ההשמעות המותר ({limit})
        </div>
      ) : isVideo ? (
        <video ref={(el) => void (ref.current = el)} {...common} playsInline className="aspect-video w-full rounded-xl bg-black" />
      ) : (
        <audio ref={(el) => void (ref.current = el)} {...common} className="w-full" />
      )}
      {limit !== null && (
        <p className="text-xs text-ink-3">
          השמעות: <span className="tabular">{Math.min(count, limit)}</span> מתוך <span className="tabular">{limit}</span>
        </p>
      )}
    </div>
  );
}
