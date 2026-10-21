"use client";
import { useState } from "react";
import { ExternalLink, Lightbulb, Link2 } from "lucide-react";
import { parseVideo } from "@/lib/video";
import { VIDEO_SOURCES } from "@/lib/video-sources";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { VideoEmbed } from "./video-embed";

/** Paste a YouTube / Vimeo / Google Drive / mp4 link instead of uploading, with pointers to COBE clip collections. */
export function VideoLinkField({ id, value, onChange, label = "או קישור לסרטון" }: { id: string; value: string | null; onChange: (v: string | null) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const v = value ?? "";
  const parsed = parseVideo(v);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium">
          <Link2 className="size-4 text-ink-3" /> {label}
        </label>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Lightbulb className="size-4" /> הצעת סרטון
        </Button>
      </div>
      {open && (
        <div className="space-y-2 rounded-lg border border-line bg-surface p-3 text-sm">
          <p className="text-ink-2">בחרו קטע באחד המאגרים, העתיקו את קישור ה־YouTube שלו והדביקו כאן.</p>
          <ul className="space-y-2">
            {VIDEO_SOURCES.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                  {s.name} <ExternalLink className="size-3.5" />
                </a>
                <span className={`ms-2 rounded px-1.5 py-0.5 text-[11px] ${s.official ? "bg-ok-soft text-ok" : "bg-subtle text-ink-3"}`}>{s.official ? "רשמי" : "אתר מורים – לא רשמי"}</span>
                <p className="text-xs text-ink-3">{s.note}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-3">ודאו שהשימוש בסרטון מותר (סרטון ציבורי ביוטיוב מוטמע מהמקור ואינו מועתק).</p>
        </div>
      )}
      <Input id={id} dir="ltr" value={v} onChange={(e) => onChange(e.target.value || null)} placeholder="https://www.youtube.com/watch?v=…" />
      {v && !parsed ? (
        <p className="text-[13px] text-danger">קישור לא נתמך. השתמשו בקישור YouTube, Vimeo, Google Drive (משותף) או קובץ mp4 ב־https.</p>
      ) : (
        <p className="text-[13px] text-ink-3">YouTube / Vimeo / Google Drive / mp4</p>
      )}
      {parsed && <VideoEmbed src={parsed} className="max-w-md" />}
    </div>
  );
}
