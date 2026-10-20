/**
 * Clearly-marked DEMO data (isDemo = true everywhere; the UI shows a "demo" banner/badges).
 *   npm run db:demo            create demo school, teacher, class, students, exam, assignment
 *   npm run db:demo -- --remove  delete all demo data and its files
 * Never run against a production database with real users unless you intend to show a demo.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { storage } from "../src/lib/storage";
import { cobeSimulationTemplate, COBE_DEFAULTS } from "../src/lib/cobe";
import { friendlyCode, randomToken } from "../src/lib/crypto";

const db = new PrismaClient();

async function remove() {
  const users = await db.user.findMany({ where: { isDemo: true }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const media = await db.mediaFile.findMany({ where: { ownerId: { in: ids } } });
  await db.assignment.deleteMany({ where: { OR: [{ isDemo: true }, { createdById: { in: ids } }] } });
  await db.exam.deleteMany({ where: { ownerId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.school.deleteMany({ where: { isDemo: true } });
  for (const m of media) await storage().delete(m.storageKey).catch(() => undefined);
  console.log(`Removed ${ids.length} demo users and ${media.length} files.`);
}

function makeDemoVideo(): Buffer | null {
  try {
    const dir = mkdtempSync(path.join(tmpdir(), "demo-"));
    const out = path.join(dir, "clip.mp4");
    execFileSync("ffmpeg", [
      "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=12",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=12", "-shortest",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", out,
    ]);
    const buf = readFileSync(out);
    rmSync(dir, { recursive: true, force: true });
    return buf;
  } catch {
    return null;
  }
}

async function create() {
  if (await db.user.findFirst({ where: { isDemo: true } })) {
    console.log("Demo data already exists. Run with --remove first to recreate.");
    return;
  }
  const password = "Demo-2026";
  const passwordHash = await bcrypt.hash(password, 12);
  const school = await db.school.create({ data: { name: "בית ספר הדגמה", teacherInviteCode: friendlyCode(8), isDemo: true } });
  const teacher = await db.user.create({
    data: { username: "demo.teacher@example.com", email: "demo.teacher@example.com", name: "מורה הדגמה", role: "TEACHER", schoolId: school.id, passwordHash, isDemo: true },
  });
  const classroom = await db.classroom.create({ data: { name: "י״א 1 – הדגמה", gradeLevel: "י״א", schoolId: school.id, teacherId: teacher.id, joinCode: friendlyCode(6), isDemo: true } });
  const names = ["תלמיד/ה הדגמה א", "תלמיד/ה הדגמה ב", "תלמיד/ה הדגמה ג"];
  for (const [i, name] of names.entries()) {
    await db.user.create({
      data: { username: `demo.student${i + 1}`, name, role: "STUDENT", schoolId: school.id, passwordHash, isDemo: true, enrollments: { create: { classroomId: classroom.id } } },
    });
  }
  const rubric = await db.rubric.findFirst({ where: { ownerId: null } });

  let videoId: string | null = null;
  const video = makeDemoVideo();
  if (video) {
    const key = `question_video/demo/${randomToken(12)}.mp4`;
    await storage().put(key, video, "video/mp4");
    const m = await db.mediaFile.create({ data: { ownerId: teacher.id, kind: "QUESTION_VIDEO", status: "READY", storageKey: key, mimeType: "video/mp4", sizeBytes: video.length, originalName: "demo-test-pattern.mp4" } });
    videoId = m.id;
  }
  const template = cobeSimulationTemplate();
  const exam = await db.exam.create({
    data: {
      ownerId: teacher.id,
      title: "סימולציית הדגמה – COBE",
      description: "מבחן הדגמה עם שאלות לדוגמה. סרטון Part C הוא תבנית בדיקה סינתטית.",
      level: "FOUR_AND_FIVE",
      mode: "SIMULATION",
      status: videoId ? "PUBLISHED" : "DRAFT",
      topics: ["Free time", "Learning", "Demo"],
      settings: { totalTimeLimitSec: COBE_DEFAULTS.totalTimeLimitSec, allowBackNavigation: false, allowReviewOwnRecording: true } as Prisma.InputJsonValue,
      rubricId: rubric?.id,
      isDemo: true,
      sections: {
        create: template.map((s, i) => ({
          order: i,
          title: s.title,
          instructions: s.instructions,
          kind: s.kind,
          choiceMode: s.choiceMode,
          mediaId: s.kind === "AUDIO_VISUAL" ? videoId : null,
          questions: { create: s.questions.map((q, j) => ({ order: j, title: q.title, prompt: q.prompt, subQuestions: q.subQuestions, prepTimeSec: q.prepTimeSec, maxRecordSec: q.maxRecordSec, points: q.points, allowReRecord: true, maxRecordings: 3 })) },
        })),
      },
    },
  });
  const practice = await db.exam.create({
    data: {
      ownerId: teacher.id,
      title: "תרגול קצר – Describing a place",
      level: "FOUR_AND_FIVE",
      mode: "PRACTICE",
      status: "PUBLISHED",
      topics: ["Places", "Demo"],
      settings: { totalTimeLimitSec: null, allowBackNavigation: true, allowReviewOwnRecording: true } as Prisma.InputJsonValue,
      rubricId: rubric?.id,
      isDemo: true,
      sections: {
        create: [
          {
            order: 0,
            title: "Warm-up",
            kind: "GENERAL",
            instructions: "Answer in one recording. Speak for about one minute.",
            questions: {
              create: [{ order: 0, title: "A place you like", prompt: "Describe a place in your town that you like to visit.", subQuestions: ["What does it look like?", "Why do you like it?"], maxRecordSec: 90, points: 10 }],
            },
          },
        ],
      },
    },
  });
  if (videoId) await db.assignment.create({ data: { examId: exam.id, classroomId: classroom.id, createdById: teacher.id, maxAttempts: 1, dueAt: new Date(Date.now() + 14 * 86400_000), isDemo: true } });
  await db.assignment.create({ data: { examId: practice.id, classroomId: classroom.id, createdById: teacher.id, isDemo: true } });
  console.log(`Demo data created (all marked as demo).
  Teacher: demo.teacher@example.com / ${password}
  Students: demo.student1, demo.student2, demo.student3 / ${password}
  Class join code: ${classroom.joinCode}${videoId ? "" : "\n  (ffmpeg not found: the COBE demo exam was left as a draft without a video)"}`);
}

(process.argv.includes("--remove") ? remove() : create()).finally(() => db.$disconnect());
