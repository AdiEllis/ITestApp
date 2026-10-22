import { Suspense } from "react";
import { NavProgress } from "@/components/nav-progress";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OralPrep – תרגול ומבחנים בעל פה", template: "%s · OralPrep" },
  description: "מערכת לתרגול ולמבחנים בעל פה בכל מקצוע, לתלמידים עם התאמות הקראה והכתבה. התלמיד שומע את השאלה ומקליט תשובה, והמורה בודקת. אינה מערכת הבחינה הרשמית.",
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
