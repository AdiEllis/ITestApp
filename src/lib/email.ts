import nodemailer, { type Transporter } from "nodemailer";
import type { Assignment } from "@prisma/client";
import { db } from "./db";
import { env } from "./env";
import { formatDateTime } from "./format";

/**
 * Emails to students, sent through any SMTP account. The simplest setup is the teacher's own Gmail
 * with an app password (see docs/EMAIL.md). Without SMTP settings nothing is sent and the site works as before.
 *
 *   SMTP_USER, SMTP_PASS   required (for Gmail: the address and a 16-letter app password)
 *   SMTP_HOST, SMTP_PORT   default smtp.gmail.com:465
 *   EMAIL_FROM             default "OralPrep <SMTP_USER>"
 *
 * EMAIL_DRIVER=log prints emails instead of sending them (tests).
 */

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function emailEnabled() {
  return process.env.EMAIL_DRIVER === "log" || !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Emails written by the "log" driver, for tests. */
export const sentEmails: Email[] = [];

let transport: Transporter | null = null;

async function send(mails: Email[]) {
  if (process.env.EMAIL_DRIVER === "log") {
    for (const m of mails) {
      sentEmails.push(m);
      console.log(`[email] to=${m.to} subject=${m.subject}`);
    }
    return;
  }
  const user = process.env.SMTP_USER!.trim();
  const port = Number(process.env.SMTP_PORT ?? 465);
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    secure: port === 465,
    // Gmail shows app passwords in groups of four; spaces are not part of the password.
    auth: { user, pass: process.env.SMTP_PASS!.replace(/\s+/g, "") },
  });
  const from = process.env.EMAIL_FROM?.trim() || `OralPrep <${user}>`;
  for (const m of mails) {
    try {
      await transport.sendMail({ from, to: m.to, subject: m.subject, html: m.html, text: m.text });
    } catch (e) {
      console.error("[email] failed", m.to, (e as Error).message);
    }
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function newAssignmentEmail(p: { to: string; studentName: string; teacherName: string; examTitle: string; dueAt: Date | null; url: string }): Email {
  const first = p.studentName.split(" ")[0];
  const due = p.dueAt ? `להגשה עד ${formatDateTime(p.dueAt)}.` : "";
  const subject = `מבחן חדש: ${p.examTitle}`;
  const text = `שלום ${first},\n\n${p.teacherName} שלח/ה לך מבחן חדש: ${p.examTitle}. ${due}\n\nכניסה למבחן: ${p.url}\n`;
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1c20;max-width:520px">
<p>שלום ${escapeHtml(first)},</p>
<p>${escapeHtml(p.teacherName)} שלח/ה לך מבחן חדש: <b dir="auto">${escapeHtml(p.examTitle)}</b>. ${escapeHtml(due)}</p>
<p><a href="${escapeHtml(p.url)}" style="display:inline-block;background:#2e49c4;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">כניסה למבחן</a></p>
<p style="color:#7b818b;font-size:13px">ההודעה נשלחה מ־OralPrep כי המורה שלך שלח/ה מבחן לכיתה.</p>
</div>`;
  return { to: p.to, subject, html, text };
}

/** Tells every student with an email address about a new assignment. Never throws. */
export async function emailNewAssignment(assignment: Pick<Assignment, "id" | "classroomId" | "specificStudents" | "dueAt" | "createdById" | "examId">) {
  if (!emailEnabled()) return 0;
  try {
    const [exam, teacher, students] = await Promise.all([
      db.exam.findUniqueOrThrow({ where: { id: assignment.examId }, select: { title: true } }),
      db.user.findUniqueOrThrow({ where: { id: assignment.createdById }, select: { name: true } }),
      db.user.findMany({
        where: {
          role: "STUDENT",
          isActive: true,
          email: { not: null },
          ...(assignment.specificStudents
            ? { assignmentTargets: { some: { assignmentId: assignment.id } } }
            : { enrollments: { some: { classroomId: assignment.classroomId } } }),
        },
        select: { email: true, name: true },
      }),
    ]);
    const url = `${env.appUrl}/s/assignments/${assignment.id}`;
    await send(students.map((s) => newAssignmentEmail({ to: s.email!, studentName: s.name, teacherName: teacher.name, examTitle: exam.title, dueAt: assignment.dueAt, url })));
    return students.length;
  } catch (e) {
    console.error("[email] new assignment", e);
    return 0;
  }
}
