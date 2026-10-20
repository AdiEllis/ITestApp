import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "יומן פעולות" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await requireUser(["ADMIN"]);
  const { action } = await searchParams;
  const logs = await db.auditLog.findMany({
    where: action ? { action: { startsWith: action } } : {},
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { actor: { select: { name: true, username: true } } },
  });
  return (
    <>
      <PageHeader title="יומן פעולות" description="פעולות רגישות: התחברות, יצירה ומחיקה של משתמשים, הגשות, ציונים, שיתוף ומחיקת נתונים. 300 האחרונות." />
      <form className="mb-3 flex gap-2">
        <input name="action" defaultValue={action} placeholder="סינון לפי פעולה (למשל student. / grade.)" dir="ltr" className="h-9 w-72 rounded-lg border border-line-strong bg-surface px-3 text-sm" aria-label="סינון" />
        <button className="h-9 rounded-lg bg-ink px-3 text-sm text-white">סינון</button>
      </form>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-subtle/70 text-xs text-ink-3">
              <tr>
                <th className="px-5 py-2.5 text-start font-medium">זמן</th>
                <th className="px-3 py-2.5 text-start font-medium">משתמש</th>
                <th className="px-3 py-2.5 text-start font-medium">פעולה</th>
                <th className="px-5 py-2.5 text-start font-medium">פרטים</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="px-5 py-2.5 whitespace-nowrap text-ink-3">{formatDateTime(l.createdAt)}</td>
                  <td className="px-3 py-2.5">{l.actor ? `${l.actor.name}` : "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs" dir="ltr">
                    {l.action}
                  </td>
                  <td className="px-5 py-2.5 font-mono text-xs text-ink-3" dir="ltr">
                    {l.entityType ? `${l.entityType}:${l.entityId}` : ""} {l.meta ? JSON.stringify(l.meta) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
