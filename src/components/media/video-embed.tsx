import type { VideoSource } from "@/lib/video";
import { cn } from "@/components/ui/cn";

export function VideoEmbed({ src, className }: { src: NonNullable<VideoSource>; className?: string }) {
  if (src.kind === "file") return <video src={src.src} controls playsInline preload="metadata" className={cn("aspect-video w-full rounded-xl bg-black", className)} />;
  return (
    <div className={cn("aspect-video w-full overflow-hidden rounded-xl bg-black", className)}>
      <iframe src={src.src} title="סרטון" className="size-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  );
}
