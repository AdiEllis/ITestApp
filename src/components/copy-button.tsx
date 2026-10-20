"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "./ui/button";

export function CopyButton({ value, label = "העתקה" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          window.prompt("העתיקו את הקישור:", value);
        }
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />}
      {done ? "הועתק" : label}
    </Button>
  );
}
