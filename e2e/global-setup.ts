import { execFileSync, execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const TMP = path.join(__dirname, ".tmp");
export const FIXTURES = path.join(TMP, "fixtures");

/** Fresh database + storage + media fixtures for every run. */
export default async function globalSetup() {
  const db = process.env.E2E_DATABASE_URL ?? "postgresql://cobe:cobe@localhost:5432/cobe_e2e?schema=public";
  rmSync(path.join(TMP, "storage"), { recursive: true, force: true });
  mkdirSync(FIXTURES, { recursive: true });
  mkdirSync(path.join(TMP, "screens"), { recursive: true });
  if (!/_e2e\b|e2e/.test(db)) throw new Error("E2E_DATABASE_URL must point to a dedicated e2e database");
  execSync(`npx prisma migrate deploy`, { env: { ...process.env, DATABASE_URL: db }, stdio: "ignore" });
  execSync(`npx tsx e2e/reset-db.ts`, { env: { ...process.env, DATABASE_URL: db }, stdio: "ignore" });
  execSync(`npx tsx prisma/seed.ts`, { env: { ...process.env, DATABASE_URL: db }, stdio: "ignore" });

  const ff = (args: string[]) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
  ff(["-f", "lavfi", "-i", "testsrc2=size=320x180:rate=15:duration=4", "-f", "lavfi", "-i", "sine=frequency=330:duration=4", "-shortest", "-c:v", "libvpx-vp9", "-b:v", "200k", "-c:a", "libopus", path.join(FIXTURES, "clip.webm")]);
  // Playwright's Chromium lacks proprietary codecs (H.264/AAC), so the playback test uses WebM; the MP4 is upload-only.
  ff(["-f", "lavfi", "-i", "testsrc2=size=320x180:rate=15:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(FIXTURES, "clip.mp4")]);
  ff(["-f", "lavfi", "-i", "sine=frequency=550:duration=2", "-c:a", "libmp3lame", path.join(FIXTURES, "question.mp3")]);
  writeFileSync(path.join(FIXTURES, "exam.pdf"), minimalPdf("COBE practice exam"));
  writeFileSync(path.join(FIXTURES, "fake.pdf"), "<html><script>alert(1)</script></html>");
}

function minimalPdf(text: string) {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${`BT /F1 18 Tf 20 70 Td (${text}) Tj ET`.length} >>\nstream\nBT /F1 18 Tf 20 70 Td (${text}) Tj ET\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}
