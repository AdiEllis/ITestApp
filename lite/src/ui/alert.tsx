import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "./cn";

const styles = {
  info: { box: "bg-brand-soft border-brand-line text-ink", icon: Info, iconClass: "text-brand" },
  ok: { box: "bg-ok-soft border-[#c4e4d3] text-ink", icon: CheckCircle2, iconClass: "text-ok" },
  warn: { box: "bg-warn-soft border-[#f1dcb5] text-ink", icon: AlertTriangle, iconClass: "text-warn" },
  danger: { box: "bg-danger-soft border-[#f0cbc6] text-ink", icon: XCircle, iconClass: "text-danger" },
};

export function Alert({ tone = "info", title, children, className }: { tone?: keyof typeof styles; title?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  const s = styles[tone];
  const Icon = s.icon;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", s.box, className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", s.iconClass)} aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-ink-2">{children}</div>}
      </div>
    </div>
  );
}
