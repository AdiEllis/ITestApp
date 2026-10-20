import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { NewExamForm } from "./form";

export const metadata = { title: "מבחן חדש" };

export default async function NewExamPage() {
  await requireUser(["TEACHER"]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link href="/t/exams" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
            <ArrowRight className="size-4" /> המבחנים שלי
          </Link>
        }
        title="מבחן חדש"
        description="בחרו נקודת התחלה. כל ההגדרות ניתנות לשינוי בהמשך."
      />
      <NewExamForm />
    </div>
  );
}
