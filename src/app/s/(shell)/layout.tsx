import { requireUser } from "@/lib/auth";
import { StudentShell } from "./shell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["STUDENT"]);
  return (
    <StudentShell name={user.name} demo={user.isDemo}>
      {children}
    </StudentShell>
  );
}
