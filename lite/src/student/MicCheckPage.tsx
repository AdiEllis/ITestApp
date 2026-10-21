import { Card } from "../ui/card";
import { Logo } from "../ui/logo";
import { MicCheck } from "./MicCheck";

export function MicCheckPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto max-w-2xl px-4 py-4">
        <Logo />
      </header>
      <main className="mx-auto max-w-2xl space-y-6 px-4 pb-16">
        <h1 className="text-2xl font-semibold">בדיקת מיקרופון</h1>
        <Card className="p-5">
          <MicCheck />
        </Card>
        <ul className="list-disc space-y-1 ps-5 text-sm text-ink-2">
          <li>הקליטו במקום שקט, קרוב למכשיר. אוזניות עם מיקרופון משפרות את האיכות.</li>
          <li>באייפון השתמשו ב־Safari, ואשרו גישה למיקרופון (הגדרות ← Safari ← מיקרופון).</li>
          <li>אם פתחתם את הקישור מתוך וואטסאפ ויש בעיה — פתחו אותו בדפדפן (⋯ ← פתיחה בדפדפן).</li>
        </ul>
      </main>
    </div>
  );
}
