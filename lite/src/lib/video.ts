/** Turns a pasted video link into something embeddable. Nothing is uploaded anywhere. */
export type VideoSource = { kind: "iframe"; src: string } | { kind: "file"; src: string } | null;

export function parseVideo(url: string): VideoSource {
  const u = url.trim();
  if (!u) return null;
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const h = parsed.hostname.replace(/^www\.|^m\./, "");
  if (h === "youtube.com" || h === "youtu.be" || h === "youtube-nocookie.com") {
    const id = h === "youtu.be" ? parsed.pathname.slice(1) : parsed.searchParams.get("v") ?? parsed.pathname.split("/").filter(Boolean).pop();
    return id && /^[\w-]{6,20}$/.test(id) ? { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` } : null;
  }
  if (h === "vimeo.com") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? { kind: "iframe", src: `https://player.vimeo.com/video/${id}` } : null;
  }
  if (h === "drive.google.com") {
    const m = parsed.pathname.match(/\/file\/d\/([\w-]+)/) ?? [null, parsed.searchParams.get("id")];
    return m[1] ? { kind: "iframe", src: `https://drive.google.com/file/d/${m[1]}/preview` } : null;
  }
  if (/\.(mp4|webm|mov|m4v)$/i.test(parsed.pathname)) return { kind: "file", src: u };
  return null;
}
