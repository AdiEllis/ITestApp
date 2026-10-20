import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Library } from "lucide-react";
import { formatDate } from "@/lib/format";
import { RemoveEntry } from "./remove";

export const metadata = { title: "ניהול מאגר" };

export default async function AdminLibrary() {
  await requireUser(["ADMIN"]);
  const entries = await db.exam.findMany({ where: { isLibraryEntry: true, status: "PUBLISHED" }, orderBy: { sharedAt: "desc" }, include: { owner: { select: { name: true, email: true } } } });
  return (
    <>
      <PageHeader title="ניהול מאגר משותף" description="הסרת תכנים שהופרו בהם זכויות יוצרים או שאינם מתאימים. עותקים שמורים יצרו אינם מושפעים." />
      <Card>
        {entries.length === 0 ? (
          <EmptyState icon={Library} title="המאגר ריק" />
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" dir="auto">
                    {e.title}
                  </p>
                  <p className="text-xs text-ink-3">
                    {e.owner.name} ({e.owner.email}) · שותף {e.sharedAt ? formatDate(e.sharedAt) : ""} · אישור זכויות {e.rightsConfirmedAt ? formatDate(e.rightsConfirmedAt) : "—"}
                  </p>
                </div>
                <RemoveEntry id={e.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
