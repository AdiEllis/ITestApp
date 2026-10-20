import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-sm text-ink-3">404</p>
      <h1 className="mt-2 text-xl font-semibold">הדף לא נמצא</h1>
      <p className="mt-1 max-w-sm text-sm text-ink-2">ייתכן שהקישור שגוי, שהפריט נמחק, או שאין לך הרשאה לצפות בו.</p>
      <LinkButton href="/" variant="secondary" className="mt-6">
        לדף הבית
      </LinkButton>
    </div>
  );
}
