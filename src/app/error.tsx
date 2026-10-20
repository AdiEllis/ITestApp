"use client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset, error }: { reset: () => void; error: Error & { digest?: string } }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">משהו השתבש</h1>
      <p className="mt-1 max-w-sm text-sm text-ink-2">אירעה שגיאה בטעינת הדף. אם הקלטת תשובה — היא שמורה במכשיר ותועלה כשהדף ייטען מחדש.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-ink-3">קוד: {error.digest}</p>}
      <Button onClick={reset} className="mt-6">
        ניסיון חוזר
      </Button>
    </div>
  );
}
