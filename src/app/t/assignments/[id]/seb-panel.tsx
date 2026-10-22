"use client";
import { useActionState } from "react";
import { Download, Lock } from "lucide-react";
import { setRequireSebAction } from "../../_actions/assignments";
import { Button, buttonClass } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

/** Classroom exam in Safe Exam Browser: turn on/off, download the config file, show the proctor's quit password. */
export function SebPanel({ id, requireSeb, quitPassword }: { id: string; requireSeb: boolean; quitPassword: string | null }) {
  const [state, action, pending] = useActionState(async (_: unknown, on: boolean) => setRequireSebAction(id, on), undefined);
  return (
    <div className="space-y-3 text-sm">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <Lock className="size-4 text-ink-3" /> מבחן בכיתה במחשב נעול
      </h2>
      {requireSeb ? (
        <>
          <p className="text-ink-2">המבחן נפתח רק בתוכנה Safe Exam Browser, שחוסמת את כל שאר האתרים והתוכנות במחשב.</p>
          <a href={`/t/assignments/${id}/seb`} className={buttonClass("primary", "sm", "w-full")}>
            <Download className="size-4" /> הורדת קובץ הפתיחה למבחן
          </a>
          <ol className="list-decimal space-y-1 ps-5 text-ink-2">
            <li>מעתיקים את הקובץ לכל מחשב בכיתה (או לתיקייה משותפת).</li>
            <li>התלמיד/ה לוחץ/ת פעמיים על הקובץ, מתחבר/ת ומתחיל/ה.</li>
            <li>בסוף ההגשה לוחצים &quot;סיום ויציאה מהמבחן&quot;, והמחשב חוזר לרגיל.</li>
          </ol>
          {quitPassword && (
            <p className="rounded-lg bg-subtle px-3 py-2">
              סיסמת יציאה למשגיח/ה: <span className="font-mono font-semibold tabular" dir="ltr">{quitPassword}</span>
              <span className="block text-xs text-ink-3">ליציאה מוקדמת מהתוכנה, למשל אם מחשב נתקע.</span>
            </p>
          )}
          <form action={() => action(false)}>
            <Button type="submit" variant="ghost" size="sm" disabled={pending}>
              ביטול: לאפשר בכל דפדפן
            </Button>
          </form>
        </>
      ) : (
        <>
          <p className="text-ink-2">כרגע אפשר לפתוח את המבחן בכל דפדפן, גם בבית. למבחן בכיתה עם משגיח/ה, אפשר לנעול אותו למחשב נעול.</p>
          <form action={() => action(true)}>
            <Button type="submit" variant="secondary" size="sm" disabled={pending}>
              <Lock className="size-4" /> נעילה למבחן בכיתה
            </Button>
          </form>
        </>
      )}
      <FormMessage state={state} />
    </div>
  );
}
