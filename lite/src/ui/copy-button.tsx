import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "./button";

export function CopyButton({ value, label = "העתקה", variant = "secondary" }: { value: string; label?: string; variant?: "secondary" | "primary" }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          window.prompt("העתיקו:", value);
        }
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? <Check className="size-4" /> : <Copy className="size-4" />}
      {done ? "הועתק" : label}
    </Button>
  );
}
