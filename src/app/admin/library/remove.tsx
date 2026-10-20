"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unshareAction } from "@/app/t/_actions/exams";
import { Button } from "@/components/ui/button";

export function RemoveEntry({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="danger"
      disabled={pending}
      onClick={() => {
        if (confirm("להסיר את המבחן מהמאגר?"))
          start(async () => {
            await unshareAction(id);
            router.refresh();
          });
      }}
    >
      הסרה
    </Button>
  );
}
