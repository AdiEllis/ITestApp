import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { CreateStaff, UserRowActions } from "./forms";

export const metadata = { title: "משתמשים" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const admin = await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80);
  const role = sp.role === "TEACHER" || sp.role === "STUDENT" || sp.role === "ADMIN" ? sp.role : undefined;
  const [users, schools] = await Promise.all([
    db.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { username: { contains: q.toLowerCase() } }, { email: { contains: q.toLowerCase() } }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { school: { select: { name: true } } },
    }),
    db.school.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const roleLabel = { ADMIN: "מנהל/ת", TEACHER: "מורה", STUDENT: "תלמיד/ה" } as const;
  return (
    <>
      <PageHeader title="משתמשים" />
      <Card className="mb-6">
        <CardHeader title="יצירת חשבון מורה / מנהל" />
        <CreateStaff schools={schools} />
      </Card>
      <form className="mb-3 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="חיפוש שם / שם משתמש / דוא״ל" className="h-9 w-64 rounded-lg border border-line-strong bg-surface px-3 text-sm" aria-label="חיפוש" />
        <select name="role" defaultValue={role ?? ""} className="h-9 rounded-lg border border-line-strong bg-surface px-2 text-sm" aria-label="תפקיד">
          <option value="">כל התפקידים</option>
          <option value="TEACHER">מורים</option>
          <option value="STUDENT">תלמידים</option>
          <option value="ADMIN">מנהלים</option>
        </select>
        <button className="h-9 rounded-lg bg-ink px-3 text-sm text-white">סינון</button>
      </form>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-subtle/70 text-xs text-ink-3">
              <tr>
                <th className="px-5 py-2.5 text-start font-medium">שם</th>
                <th className="px-3 py-2.5 text-start font-medium">שם משתמש</th>
                <th className="px-3 py-2.5 text-start font-medium">תפקיד</th>
                <th className="px-3 py-2.5 text-start font-medium">בית ספר</th>
                <th className="px-3 py-2.5 text-start font-medium">נוצר</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id} className={u.isActive ? "" : "opacity-60"}>
                  <td className="px-5 py-3 font-medium">
                    {u.name} {!u.isActive && <Badge tone="danger">מושבת</Badge>} {u.isDemo && <Badge tone="warn">הדגמה</Badge>}
                  </td>
                  <td className="px-3 py-3 font-mono text-[13px]" dir="ltr">
                    {u.username}
                  </td>
                  <td className="px-3 py-3">{roleLabel[u.role]}</td>
                  <td className="px-3 py-3 text-ink-3">{u.school?.name ?? "—"}</td>
                  <td className="px-3 py-3 text-ink-3">{formatDate(u.createdAt)}</td>
                  <td className="px-5 py-3">{u.id !== admin.id && <UserRowActions id={u.id} name={u.name} active={u.isActive} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
