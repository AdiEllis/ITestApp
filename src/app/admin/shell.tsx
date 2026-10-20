"use client";
import { Library, School, ScrollText, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";

export function AdminShell({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <AppShell
      home="/admin"
      user={{ name }}
      roleLabel="מנהל/ת מערכת"
      items={[
        { href: "/admin", label: "בתי ספר", icon: School, exact: true },
        { href: "/admin/users", label: "משתמשים", icon: Users },
        { href: "/admin/library", label: "מאגר משותף", icon: Library },
        { href: "/admin/audit", label: "יומן פעולות", icon: ScrollText },
      ]}
    >
      {children}
    </AppShell>
  );
}
