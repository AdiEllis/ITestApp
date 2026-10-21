import { ClipboardCheck, Link2, Mic, ShieldCheck } from "lucide-react";
import { Logo } from "./ui/logo";
import { buttonClass } from "./ui/button";
import { SIMULATION_DISCLAIMER } from "./lib/cobe";

export function Landing() {
  const steps = [
    { icon: Link2, title: "1. המורה יוצרת מבחן ושולחת קישור", body: "בונים מבחן (או מתבנית COBE) ושולחים לתלמידים קישור בוואטסאפ, במייל או ב־Classroom." },
    { icon: Mic, title: "2. התלמידים מקליטים מהטלפון", body: "בדיקת מיקרופון, זמני הכנה והקלטה, ובסוף שליחת קובץ הגשה אחד למורה — באותה דרך." },
    { icon: ClipboardCheck, title: "3. המורה בודקת ומחזירה משוב", body: "מייבאים את הקבצים, מאזינים, נותנים ציון לפי מחוון ושולחים לכל תלמיד קישור משוב." },
    { icon: ShieldCheck, title: "בלי חשבונות ובלי שרת", body: "שום הקלטה לא נשמרת באינטרנט. הנתונים נשארים בטלפון של התלמיד ובדפדפן של המורה." },
  ];
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        <a href="#/mic" className="text-sm text-ink-2 hover:text-ink">
          בדיקת מיקרופון
        </a>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-12">
        <section className="py-12 sm:py-16">
          <p className="mb-4 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2">תרגול הבגרות בעל פה באנגלית · 4 ו־5 יח״ל</p>
          <h1 className="max-w-2xl text-[32px] font-semibold leading-[1.15] tracking-tight sm:text-[44px]">
            תרגול COBE לכיתה — <span className="text-brand">בלי חשבונות, בחינם.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">כלי פשוט למורה: יוצרים מבחן, שולחים קישור, מקבלים הקלטות, בודקים ומחזירים משוב.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#/t" className={buttonClass("primary", "lg")}>
              כניסה למורה
            </a>
          </div>
          <p className="mt-3 text-sm text-ink-3">תלמידים? פתחו את הקישור שקיבלתם מהמורה.</p>
        </section>
        <section className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
          {steps.map((s) => (
            <div key={s.title} className="bg-surface p-6">
              <s.icon className="size-5 text-brand" aria-hidden />
              <h2 className="mt-3 font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{s.body}</p>
            </div>
          ))}
        </section>
        <p className="pt-10 text-center text-xs text-ink-3">{SIMULATION_DISCLAIMER}</p>
      </main>
    </div>
  );
}
