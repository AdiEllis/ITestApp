import { cn } from "./cn";

/** English (LTR) content embedded inside the Hebrew RTL interface. */
export function En({ as: Tag = "div", className, children }: { as?: "div" | "span" | "p" | "h2" | "h3" | "li"; className?: string; children: React.ReactNode }) {
  return (
    <Tag lang="en" dir="ltr" className={cn("text-left", className)}>
      {children}
    </Tag>
  );
}
