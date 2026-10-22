import { cn } from "./cn";

/**
 * Exam content (questions, instructions) inside the Hebrew interface. Content can be in Hebrew,
 * Arabic or English, so its direction follows the text itself.
 */
export function En({ as: Tag = "div", className, children }: { as?: "div" | "span" | "p" | "h2" | "h3" | "li"; className?: string; children: React.ReactNode }) {
  return (
    <Tag dir="auto" className={cn("text-start", className)}>
      {children}
    </Tag>
  );
}
