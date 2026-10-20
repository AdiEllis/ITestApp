import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { ImportWizard } from "./wizard";

export const metadata = { title: "העלאת מבחן מוכן" };

export default async function ImportPage() {
  await requireUser(["TEACHER"]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={
          <Link href="/t/exams" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
            <ArrowRight className="size-4" /> המבחנים שלי
          </Link>
        }
        title="העלאת מבחן מוכן"
        description="העלו את קובצי המבחן (PDF, Word, שמע, וידאו). בשלב הבא תוכלו להקליד את השאלות ולשייך את קובצי השמע והווידאו לכל שאלה."
      />
      <ImportWizard />
    </div>
  );
}
