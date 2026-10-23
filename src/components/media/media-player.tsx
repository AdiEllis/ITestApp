"use client";
import { FileText, Download } from "lucide-react";
import { mediaCategory } from "@/lib/files";
import { RecordingAudio } from "./recording-audio";

export function MediaPlayer({ id, mimeType, name, className }: { id: string; mimeType: string; name?: string | null; className?: string }) {
  const src = `/api/media/${id}`;
  const cat = mediaCategory(mimeType);
  if (cat === "audio") return <RecordingAudio src={src} className={className ?? "w-full"} />;
  if (cat === "video")
    return <video controls playsInline preload="metadata" src={src} className={className ?? "aspect-video w-full rounded-lg bg-black"} />;
  // eslint-disable-next-line @next/next/no-img-element
  if (cat === "image") return <img src={src} alt={name ?? ""} className={className ?? "max-h-72 rounded-lg border border-line object-contain"} />;
  return (
    <a href={cat === "pdf" ? src : `${src}?download=1`} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-lg border border-line bg-subtle px-3 py-2 text-sm hover:bg-[#e9e9e4]">
      {cat === "pdf" ? <FileText className="size-4 text-danger" /> : <Download className="size-4" />}
      <span className="max-w-64 truncate" dir="auto">{name ?? "קובץ"}</span>
    </a>
  );
}
