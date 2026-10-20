"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { copyFromLibraryAction, unshareAction } from "../../_actions/exams";
import { Button } from "@/components/ui/button";

export function LibraryActions({ entryId, mine }: { entryId: string; mine: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <>
      {mine && (
        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!confirm("להסיר את המבחן מהמאגר? עותקים שמורים אחרים כבר יצרו לא יושפעו.")) return;
            start(async () => {
              const r = await unshareAction(entryId);
              if (!r.ok) setError(r.error);
              else router.push("/t/library");
            });
          }}
        >
          הסרה מהמאגר
        </Button>
      )}
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await copyFromLibraryAction(entryId);
            if (r && !r.ok) setError(r.error);
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />} העתקה למבחנים שלי
      </Button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </>
  );
}
