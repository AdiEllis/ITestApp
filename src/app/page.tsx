import { redirect } from "next/navigation";
import { CalendarClock, ClipboardCheck, Headphones, Library, Mic, ShieldCheck } from "lucide-react";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { LinkButton } from "@/components/ui/button";
import { SIMULATION_DISCLAIMER } from "@/lib/cobe";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));
  const features = [
    { icon: Headphones, title: "שומעים את השאלה", body: "כל שאלה מוקראת בקול. המורה מאזינה ומאשרת את ההקראה, וכל התלמידים שומעים בדיוק אותה." },
    { icon: Mic, title: "עונים בהקלטה", body: "בדיקת מיקרופון, שמירה מקומית עד שההעלאה מצליחה, וחיווי ברור על כל שלב." },
    { icon: CalendarClock, title: "לאורך כל השנה, בכל מקצוע", body: "מבחן קצר על מה שנלמד עד עכשיו, בבית או בכיתה, בלי מורה מקריאה צמודה." },
    { icon: ShieldCheck, title: "מבחן בכיתה במחשב נעול", body: "המבחן נפתח רק בתוך Safe Exam Browser, בלי גישה לאתרים אחרים." },
    { icon: ClipboardCheck, title: "בדיקה ומשוב של המורה", body: "המורה מאזינה או קוראת, נותנת ציון והערה לכל שאלה, וציון סופי — בלי בינה מלאכותית." },
    { icon: Library, title: "מאגר מבחנים משותף", body: "שיתוף מבחנים בין מורים והעתקה לספרייה אישית לעריכה חופשית." },
    { icon: ShieldCheck, title: "פרטיות תלמידים", body: "הקלטות פרטיות בגישה זמנית בלבד, הרשאות לפי תפקיד ומדיניות מחיקה." },
  ];
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex gap-2">
          <LinkButton href="/join" variant="ghost" size="sm">
            הצטרפות לכיתה
          </LinkButton>
          <LinkButton href="/login" variant="secondary" size="sm">
            התחברות
          </LinkButton>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5">
        <section className="py-14 sm:py-20">
          <p className="mb-4 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2">לתלמידים עם התאמות הקראה והכתבה</p>
          <h1 className="max-w-2xl text-[34px] font-semibold leading-[1.15] tracking-tight sm:text-5xl">
            מבחנים בעל פה, <span className="text-brand">לאורך כל השנה.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
            המורה כותבת שאלות על החומר שנלמד. התלמיד/ה שומע/ת כל שאלה ומקליט/ה תשובה, והמורה מאזינה, נותנת ציון ומשוב.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/register" size="lg">
              פתיחת חשבון מורה
            </LinkButton>
            <LinkButton href="/join" size="lg" variant="secondary">
              יש לי קוד כיתה
            </LinkButton>
          </div>
        </section>
        <section className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="bg-surface p-6">
              <f.icon className="size-5 text-brand" aria-hidden />
              <h2 className="mt-3 font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{f.body}</p>
            </div>
          ))}
        </section>
        <p className="py-10 text-center text-xs text-ink-3">{SIMULATION_DISCLAIMER}</p>
      </main>
    </div>
  );
}
