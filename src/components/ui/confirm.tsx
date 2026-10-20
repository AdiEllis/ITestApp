"use client";
import { useRef } from "react";
import { Button } from "./button";
import { SubmitButton } from "./submit-button";

/** Button that asks for confirmation in an accessible <dialog> before running a server action. */
export function ConfirmAction({
  action,
  trigger,
  title,
  body,
  confirmLabel = "אישור",
  variant = "danger",
  triggerVariant,
  size = "sm",
}: {
  action: () => Promise<unknown>;
  trigger: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  variant?: "danger" | "primary";
  triggerVariant?: "danger" | "secondary" | "ghost" | "primary";
  size?: "sm" | "md";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button variant={triggerVariant ?? (variant === "danger" ? "danger" : "secondary")} size={size} onClick={() => ref.current?.showModal()}>
        {trigger}
      </Button>
      <dialog
        ref={ref}
        className="m-auto w-[min(440px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-ink/30"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <form
          action={async () => {
            await action();
            ref.current?.close();
          }}
          className="p-5"
        >
          <h2 className="text-[17px] font-semibold">{title}</h2>
          {body && <div className="mt-2 text-sm leading-relaxed text-ink-2">{body}</div>}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => ref.current?.close()}>
              ביטול
            </Button>
            <SubmitButton variant={variant === "danger" ? "primary" : "primary"} className={variant === "danger" ? "bg-danger hover:bg-[#a5281f]" : ""}>
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
