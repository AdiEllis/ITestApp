"use client";
import { BookOpen, ClipboardCheck, LayoutDashboard, Library, ListChecks, Ruler, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DemoBanner } from "@/components/demo-banner";

export function TeacherShell({ user, pending, demo, children }: { user: { name: string }; pending: number; demo: boolean; children: React.ReactNode }) {
  return (
    <AppShell
      home="/t"
      user={user}
      roleLabel="מורה"
      banner={demo ? <DemoBanner /> : null}
      items={[
        { href: "/t", label: "לוח בקרה", icon: LayoutDashboard, exact: true },
        { href: "/t/classes", label: "כיתות ותלמידים", icon: Users },
        { href: "/t/exams", label: "המבחנים שלי", icon: BookOpen },
        { href: "/t/library", label: "מאגר משותף", icon: Library },
        { href: "/t/assignments", label: "משימות", icon: ListChecks },
        { href: "/t/review", label: "בדיקת הגשות", icon: ClipboardCheck, badge: pending },
        { href: "/t/rubrics", label: "מחוונים", icon: Ruler },
      ]}
    >
      {children}
    </AppShell>
  );
}
