import { Suspense } from "react";
import { NavProgress } from "@/components/nav-progress";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OralPrep – תרגול בגרות בעל פה באנגלית", template: "%s · OralPrep" },
  description: "מערכת לתרגול הבחינה בעל פה באנגלית (COBE) למורים ולתלמידים. סימולציה עצמאית — אינה המערכת הרשמית.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f6f3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-dvh antialiased">
        <Suspense>
          <NavProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
