"use client";
import { BookOpen, CircleHelp, ClipboardCheck, LayoutDashboard, Library, ListChecks, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DemoBanner } from "@/components/demo-banner";

export function TeacherShell({ user, pending, demo, children }: { user: { name: string }; pending: number; demo: boolean; children: React.ReactNode }) {
  return (
    <AppShell
      home="/t"
      user={user}
      roleLabel="מורה"
      banner={demo ? <DemoBanner /> : null}
      hideTabs={(p) => /^\/t\/review\/[^/]+$/.test(p)}
      items={[
        { href: "/t", label: "ראשי", icon: LayoutDashboard, exact: true, tab: "ראשי" },
        { href: "/t/exams", label: "המבחנים שלי", icon: BookOpen, tab: "מבחנים" },
        { href: "/t/review", label: "בדיקת הגשות", icon: ClipboardCheck, badge: pending, tab: "בדיקה" },
        { href: "/t/classes", label: "כיתות ותלמידים", icon: Users, tab: "כיתות" },
        { href: "/t/assignments", label: "מבחנים שנשלחו", icon: ListChecks },
        { href: "/t/library", label: "מאגר משותף", icon: Library },
        { href: "/t/help", label: "מדריך ועזרה", icon: CircleHelp },
      ]}
    >
      {children}
    </AppShell>
  );
}
