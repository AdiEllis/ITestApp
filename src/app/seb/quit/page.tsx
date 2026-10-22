import { CheckCircle2 } from "lucide-react";

export const metadata = { title: "סיום המבחן" };

/**
 * Safe Exam Browser closes itself when it reaches this address (the config file's quit URL).
 * In any other browser this is just a short goodbye page.
 */
export default function SebQuitPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <CheckCircle2 className="size-10 text-ok" />
      <h1 className="mt-3 text-xl font-semibold">המבחן הסתיים</h1>
      <p className="mt-2 text-sm text-ink-2">אפשר לסגור את החלון.</p>
    </div>
  );
}
