import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { emailNewAssignment, newAssignmentEmail, sentEmails } from "@/lib/email";
import { makeUser, resetDb, scenario } from "./helpers";

describe("new exam email", () => {
  beforeEach(async () => {
    await resetDb();
    sentEmails.length = 0;
    process.env.EMAIL_DRIVER = "log";
  });
  afterAll(() => {
    delete process.env.EMAIL_DRIVER;
  });

  it("goes to every student in the class who has an email address, with a link to the exam", async () => {
    const s = await scenario();
    await db.user.update({ where: { id: s.student.id }, data: { email: "maya@school.test", name: "מאיה לוי" } });
    // A student with a username only, and an inactive one, get nothing.
    const noEmail = await makeUser("STUDENT", s.school.id);
    const inactive = await makeUser("STUDENT", s.school.id);
    await db.user.update({ where: { id: inactive.id }, data: { email: "gone@school.test", isActive: false } });
    await db.enrollment.createMany({ data: [noEmail, inactive].map((u) => ({ classroomId: s.classroom.id, studentId: u.id })) });

    expect(await emailNewAssignment(s.assignment)).toBe(1);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe("maya@school.test");
    expect(sentEmails[0].subject).toBe("מבחן חדש: Exam");
    expect(sentEmails[0].text).toContain("שלום מאיה");
    expect(sentEmails[0].html).toContain(`/s/assignments/${s.assignment.id}`);
  });

  it("an exam sent to specific students only emails them", async () => {
    const s = await scenario();
    const other = await makeUser("STUDENT", s.school.id);
    await db.user.update({ where: { id: s.student.id }, data: { email: "a@school.test" } });
    await db.user.update({ where: { id: other.id }, data: { email: "b@school.test" } });
    await db.enrollment.create({ data: { classroomId: s.classroom.id, studentId: other.id } });
    const a = await db.assignment.create({
      data: { examId: s.exam.id, classroomId: s.classroom.id, createdById: s.teacher.id, specificStudents: true, students: { create: { studentId: other.id } } },
    });
    await emailNewAssignment(a);
    expect(sentEmails.map((m) => m.to)).toEqual(["b@school.test"]);
  });

  it("escapes the exam title in the HTML", () => {
    const m = newAssignmentEmail({ to: "x@y.z", studentName: "Noa", teacherName: "T", examTitle: "<b>x</b>", dueAt: null, url: "https://a.b/s/assignments/1" });
    expect(m.html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
