"use client";
import { useEffect, useState } from "react";
import { Alert } from "./ui/alert";

/** Google blocks sign-in inside app browsers (Instagram, Facebook, some WhatsApp views): tell people to open a real browser. */
export function InAppBrowserHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(/FBAN|FBAV|Instagram|Line\/|TikTok|Snapchat|; wv\)|WhatsApp/i.test(navigator.userAgent));
  }, []);
  if (!show) return null;
  return (
    <Alert tone="warn" title="פתחו את הקישור בדפדפן">
      נראה שהדף נפתח בתוך אפליקציה. כדי להתחבר עם Google, פתחו אותו ב־Chrome או ב־Safari: לחצו על ⋯ (או על סמל השיתוף) ← &quot;פתיחה בדפדפן&quot;.
    </Alert>
  );
}
