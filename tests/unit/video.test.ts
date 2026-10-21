import { describe, expect, it } from "vitest";
import { parseVideo } from "@/lib/video";

describe("video links", () => {
  it("embeds YouTube in privacy-enhanced mode", () => {
    for (const u of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "https://www.youtube.com/shorts/dQw4w9WgXcQ"])
      expect(parseVideo(u)).toEqual({ kind: "iframe", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1" });
  });
  it("supports Vimeo, Google Drive and https mp4", () => {
    expect(parseVideo("https://vimeo.com/76979871")?.src).toBe("https://player.vimeo.com/video/76979871");
    expect(parseVideo("https://drive.google.com/file/d/1AbC_d-E/view?usp=sharing")?.src).toBe("https://drive.google.com/file/d/1AbC_d-E/preview");
    expect(parseVideo("https://example.org/clip.mp4")).toEqual({ kind: "file", src: "https://example.org/clip.mp4" });
  });
  it("rejects unsupported, insecure or script URLs", () => {
    for (const u of ["", "not a url", "http://youtube.com/watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "https://evil.example/page", "https://www.youtube.com/watch?v=<script>"]) expect(parseVideo(u)).toBeNull();
  });
});
