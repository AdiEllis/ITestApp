import { Logo } from "@/components/logo";

export const metadata = { title: "מדריך לתלמידים" };

const STEPS = [
  ["נכנסים", "לוחצים על הקישור מהמורה ← \"הצטרפות עם Google\". בפעמים הבאות: \"התחברות עם Google\" באתר."],
  ["בודקים מיקרופון", "בתחילת המבחן לוחצים \"הפעלת מיקרופון\" ← \"אפשר\" ← מקליטים ניסיון ושומעים אותו."],
  ["עונים", "קוראים את השאלות (באנגלית) ← \"התחלת הקלטה\" ← עונים על כל השאלות ברצף ← \"סיום הקלטה\". מופיע ✓ \"התשובה נשמרה\"."],
  ["מגישים", "בסוף: \"סיום והגשה\" ← \"הגשה סופית\". המורה תבדוק ותשלח משוב."],
  ["רואים ציון", "כשהמורה מפרסמת — הציון והמשוב מופיעים בעמוד הבית ובהיסטוריה."],
];

const TIPS = [
  "מומלץ להקליט במקום שקט, עם אוזניות אם יש.",
  "אם נפתח בתוך וואטסאפ ולא מצליחים להתחבר: ⋯ ← \"פתיחה בדפדפן\".",
  "באייפון, אם המיקרופון חסום: הגדרות ← Safari ← מיקרופון ← אפשר.",
  "נפל האינטרנט? לא נורא — ההקלטה שמורה בטלפון ותעלה כשהחיבור יחזור.",
];

export default function StudentHelp() {
  return (
    <div className="mx-auto max-w-xl px-5 py-6">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold">איך מתרגלים?</h1>
      <p className="mt-1 text-ink-2">חמישה צעדים, מהטלפון.</p>
      <ol className="mt-6 space-y-4">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-base font-semibold text-white">{i + 1}</span>
            <div>
              <p className="font-semibold">{t}</p>
              <p className="mt-0.5 text-[15px] leading-relaxed text-ink-2">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <h2 className="mt-8 font-semibold">טיפים</h2>
      <ul className="mt-2 list-disc space-y-1.5 ps-5 text-[15px] text-ink-2">
        {TIPS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <a href="/s/mic-check" className="mt-8 inline-flex h-11 items-center rounded-lg bg-brand px-5 font-medium text-white">
        בדיקת מיקרופון עכשיו
      </a>
    </div>
  );
}
