import { CheckCircle2, ClipboardCheck, Link2, ListChecks, PenLine, Printer, Users } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/card";
import { PrintButton } from "./print-button";

export const metadata = { title: "מדריך למורה" };

const STEPS = [
  {
    icon: Users,
    title: "1. יוצרים כיתה ומצרפים תלמידים",
    where: "כיתות ותלמידים",
    items: [
      "לוחצים \"כיתות ותלמידים\" בתפריט, כותבים שם לכיתה ולוחצים \"יצירת כיתה\".",
      "בדף הכיתה לוחצים \"שליחה בוואטסאפ\" ושולחים את הקישור לקבוצת הכיתה.",
      "כל תלמיד/ה לוחץ/ת על הקישור ועל \"הצטרפות עם Google\". זהו — בלי סיסמאות.",
    ],
  },
  {
    icon: PenLine,
    title: "2. יוצרים מבחן",
    where: "המבחנים שלי ← מבחן חדש",
    items: [
      "בוחרים \"מבחן חדש\", כותבים שם ומקצוע ולוחצים \"יצירה\".",
      "כותבים את השאלות. אפשר עם ניקוד, כדי שהקול יקרא נכון. הכול נשמר לבד.",
      "בכל שאלה, ב\"הקראת השאלה לתלמיד/ה\": לוחצים \"יצירת הקראה אוטומטית\" או מקליטים בקול שלכם, מאזינים עד הסוף ומסמנים שההקראה נכונה.",
      "לוחצים \"פרסום\". אם חסר משהו (למשל הקראה שלא אושרה), המערכת תכתוב בדיוק מה.",
    ],
  },
  {
    icon: ListChecks,
    title: "3. שולחים את המבחן לכיתה",
    where: "כפתור \"הקצאה לכיתה\" בעמוד המבחן",
    items: ["בוחרים כיתה ותאריך הגשה (לא חובה) ולוחצים \"הקצאה\".", "התלמידים יראו את המבחן מיד כשייכנסו לאתר."],
  },
  {
    icon: ClipboardCheck,
    title: "4. בודקים ונותנים משוב",
    where: "בדיקת הגשות",
    items: [
      "לוחצים על הגשה ← ▶ להאזנה.",
      "לכל קריטריון בוחרים רמה (מצוין / טוב / חלקי / חלש). הציון מחושב לבד.",
      "כותבים משוב קצר ולוחצים \"פרסום לתלמיד/ה\".",
    ],
  },
];

const FAQ = [
  ["תלמיד/ה לא מצליח/ה להתחבר", "ודאו שהקישור נפתח בדפדפן (Chrome או Safari) ולא בתוך וואטסאפ/אינסטגרם: ⋯ ← \"פתיחה בדפדפן\". אם זה חשבון Google של בית הספר שחסום — אפשר להיכנס עם Gmail אישי, או ללחוץ \"אין לי חשבון Google\" בדף ההצטרפות."],
  ["המיקרופון לא עובד אצל תלמיד/ה", "בתחילת המבחן יש בדיקת מיקרופון. אם הגישה נחסמה, באייפון: הגדרות ← Safari ← מיקרופון ← \"אפשר\". ב־Android: לחיצה על המנעול ליד כתובת האתר ← מיקרופון ← \"אפשר\"."],
  ["מה קורה אם האינטרנט נופל באמצע?", "ההקלטה נשמרת בטלפון ועולה לבד כשהחיבור חוזר. לא צריך לעשות כלום."],
  ["רציתי לשנות מבחן אבל כתוב שהוא נעול", "אחרי שתלמידים התחילו לענות, המבחן נעול כדי שכולם ייבדקו על אותה גרסה. לוחצים \"שכפול מבחן\" ומשנים את העותק."],
  ["מה ההבדל בין \"תרגול\" ל\"מבחן\"?", "תרגול — בלי מגבלת זמן, אפשר לחזור לשאלות. מבחן — כמו בבחינה: זמן הכנה, הקלטה שמתחילה לבד וזמן כולל."],
  ["תלמיד/ה רוצה לנסות שוב", "בעמוד הבדיקה לוחצים \"החזרת המבחן לתלמיד/ה לתרגול נוסף\"."],
  ["איך יודעים מי לא הגיש?", "בלוח הבקרה ← \"תלמידים שלא הגישו\", או בעמוד המשימה."],
  ["האם זו הבחינה הרשמית?", "לא. זו מערכת תרגול עצמאית. היא אינה iTest ואינה מערכת משרד החינוך."],
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="מדריך למורה" description="ארבעה צעדים — ואת מוכנה. כל עמוד באתר כולל גם כפתור &quot;איך עושים את זה?&quot;." actions={<PrintButton />} />
      <div className="space-y-4">
        {STEPS.map((s) => (
          <Card key={s.title} className="p-5">
            <div className="flex items-start gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <s.icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">{s.title}</h2>
                <p className="mt-0.5 text-sm text-ink-3">איפה: {s.where}</p>
                <ul className="mt-3 space-y-2">
                  {s.items.map((it) => (
                    <li key={it} className="flex gap-2 text-[15px] leading-relaxed">
                      <CheckCircle2 className="mt-1 size-4 shrink-0 text-ok" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Link2 className="size-5 text-brand" /> מדריך לתלמידים
        </h2>
        <p className="mt-1 text-[15px] text-ink-2">דף קצר עם הסבר לתלמידים — אפשר לשלוח להם את הקישור יחד עם קישור ההצטרפות.</p>
        <a href="/help/students" target="_blank" className="mt-3 inline-flex text-sm font-medium text-brand hover:underline">
          פתיחת המדריך לתלמידים ←
        </a>
      </Card>

      <h2 className="mb-3 mt-8 text-lg font-semibold">שאלות נפוצות</h2>
      <div className="space-y-2">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group rounded-xl border border-line bg-surface px-4 py-3">
            <summary className="cursor-pointer list-none font-medium marker:hidden">
              <span className="me-2 inline-block text-ink-3 transition-transform group-open:rotate-90">‹</span>
              {q}
            </summary>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{a}</p>
          </details>
        ))}
      </div>
      <p className="mt-8 flex items-center gap-1.5 text-xs text-ink-3">
        <Printer className="size-3.5" /> אפשר להדפיס את המדריך ולתלות ליד המחשב.
      </p>
    </div>
  );
}
