import { AlertTriangle, BookOpen, ClipboardCheck, HardDrive, Inbox, Plus, Users } from "lucide-react";
import { useStore } from "../lib/use-store";
import { exams, settings, submissions } from "../lib/store";
import { Card, CardHeader, PageHeader } from "../ui/card";
import { buttonClass } from "../ui/button";
import { Alert } from "../ui/alert";
import { EmptyState } from "../ui/empty-state";
import { formatDate, formatDateTime, normalizeName } from "../lib/format";

function Stat({ label, value, icon: Icon, href }: { label: string; value: number; icon: typeof Users; href: string }) {
  return (
    <a href={href} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-2">{label}</p>
        <Icon className="size-4 text-ink-3" aria-hidden />
      </div>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular">{value}</p>
    </a>
  );
}

export function Dashboard() {
  const data = useStore(async () => ({ exams: await exams.list(), subs: await submissions.list(), lastBackup: await settings.lastBackup() }));
  if (!data) return null;
  const pending = data.subs.filter((s) => s.grading?.status !== "done");
  const students = new Set(data.subs.map((s) => normalizeName(s.studentName))).size;
  const needsBackup = data.subs.length > 0 && (!data.lastBackup || Date.now() - data.lastBackup > 14 * 86400_000);

  if (data.exams.length === 0 && data.subs.length === 0)
    return (
      <>
        <PageHeader title="ברוכה הבאה" description="שלושה צעדים כדי להתחיל:" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { n: 1, t: "יצירת מבחן", d: "מתבנית COBE או מבחן ריק. שאלות, זמני הכנה והקלטה, וסרטון מיוטיוב.", href: "#/t/exams/new", cta: "מבחן חדש" },
            { n: 2, t: "שליחת קישור", d: "מעתיקים קישור לכל כיתה ושולחים בוואטסאפ, במייל או ב־Classroom.", href: "#/t/exams", cta: "מבחנים" },
            { n: 3, t: "קבלת הגשות ובדיקה", d: "התלמידים שולחים קובץ הגשה. מייבאים, מאזינים, נותנים ציון ומחזירים משוב.", href: "#/t/inbox", cta: "הגשות" },
          ].map((s) => (
            <Card key={s.n} className="flex flex-col p-5">
              <span className="grid size-7 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong">{s.n}</span>
              <h2 className="mt-3 font-semibold">{s.t}</h2>
              <p className="mt-1 flex-1 text-sm text-ink-2">{s.d}</p>
              <a href={s.href} className={buttonClass(s.n === 1 ? "primary" : "secondary", "sm", "mt-4 self-start")}>
                {s.cta}
              </a>
            </Card>
          ))}
        </div>
        <Alert tone="info" className="mt-6" title="איפה נשמרים הנתונים?">
          הכול נשמר בדפדפן במחשב הזה בלבד — בלי חשבון ובלי שרת. כדי לא לאבד עבודה, שמרו גיבוי מדי פעם בעמוד "גיבוי והגדרות" (ושם גם אפשר להעביר את הנתונים למחשב אחר).
        </Alert>
      </>
    );

  return (
    <>
      <PageHeader
        title="לוח בקרה"
        description={pending.length ? `${pending.length} הגשות ממתינות לבדיקה.` : "אין הגשות שממתינות לבדיקה."}
        actions={
          <>
            <a href="#/t/inbox" className={buttonClass("secondary", "sm")}>
              <Inbox className="size-4" /> ייבוא הגשות
            </a>
            <a href="#/t/exams/new" className={buttonClass("primary", "sm")}>
              <Plus className="size-4" /> מבחן חדש
            </a>
          </>
        }
      />
      {needsBackup && (
        <Alert tone="warn" className="mb-4" title={data.lastBackup ? `הגיבוי האחרון: ${formatDate(data.lastBackup)}` : "עדיין לא נשמר גיבוי"}>
          ההגשות והציונים שמורים רק בדפדפן הזה.{" "}
          <a href="#/t/settings" className="font-medium text-brand">
            שמירת גיבוי
          </a>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="מבחנים" value={data.exams.length} icon={BookOpen} href="#/t/exams" />
        <Stat label="תלמידים" value={students} icon={Users} href="#/t/students" />
        <Stat label="הגשות שהתקבלו" value={data.subs.length} icon={Inbox} href="#/t/inbox" />
        <Stat label="ממתינות לבדיקה" value={pending.length} icon={ClipboardCheck} href="#/t/inbox" />
      </div>
      <Card className="mt-6">
        <CardHeader title="ממתינות לבדיקה" />
        {pending.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="הכול נבדק" body="כשתלמידים ישלחו קובצי הגשה, ייבאו אותם בעמוד ההגשות." />
        ) : (
          <ul className="divide-y divide-line">
            {pending.slice(0, 8).map((s) => (
              <li key={s.id}>
                <a href={`#/t/review/${encodeURIComponent(s.id)}`} className="flex items-center gap-3 px-5 py-3 hover:bg-subtle/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.studentName}</p>
                    <p className="truncate text-xs text-ink-3" dir="auto">
                      {s.exam.title}
                      {s.className ? ` · ${s.className}` : ""} · {formatDateTime(s.submittedAt)}
                    </p>
                  </div>
                  {s.grading?.status === "draft" && <span className="text-xs text-warn">טיוטה</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {!("storage" in navigator) && (
        <p className="mt-4 flex items-center gap-1 text-xs text-ink-3">
          <AlertTriangle className="size-3.5" /> <HardDrive className="size-3.5" /> הדפדפן אינו תומך בשמירה קבועה — הקפידו על גיבוי.
        </p>
      )}
    </>
  );
}
