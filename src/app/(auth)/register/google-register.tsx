"use client";
import { useState } from "react";
import Link from "next/link";
import { Field, Input } from "@/components/ui/field";
import { GoogleButton } from "@/components/google-button";

export function GoogleRegister() {
  const [school, setSchool] = useState("");
  const [invite, setInvite] = useState("");
  const [hasCode, setHasCode] = useState(false);
  return (
    <div className="space-y-4">
      {hasCode ? (
        <Field label="קוד בית הספר" htmlFor="invite" hint="קיבלת אותו ממורה אחר/ת בבית הספר">
          <Input id="invite" value={invite} onChange={(e) => setInvite(e.target.value)} dir="ltr" className="uppercase tracking-widest" />
        </Field>
      ) : (
        <Field label="שם בית הספר" htmlFor="school" hint="לא חובה. אפשר לשנות אחר כך.">
          <Input id="school" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="לדוגמה: תיכון הרצל" />
        </Field>
      )}
      <GoogleButton params={{ intent: "teacher", school: hasCode ? undefined : school, invite: hasCode ? invite : undefined }} label="הרשמה עם Google" />
      <p className="text-[13px] text-ink-3">
        בהרשמה את/ה מאשר/ת את{" "}
        <Link href="/privacy" target="_blank" className="text-brand hover:underline">
          מדיניות הפרטיות
        </Link>
        .{" "}
        <button type="button" className="text-brand hover:underline" onClick={() => setHasCode((v) => !v)}>
          {hasCode ? "פתיחת בית ספר חדש" : "יש לי קוד בית ספר"}
        </button>
      </p>
    </div>
  );
}
