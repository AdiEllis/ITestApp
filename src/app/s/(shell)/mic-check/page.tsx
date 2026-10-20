import { Card, PageHeader } from "@/components/ui/card";
import { MicCheck } from "@/components/runner/mic-check";

export const metadata = { title: "בדיקת מיקרופון" };

export default function MicCheckPage() {
  return (
    <>
      <PageHeader title="בדיקת מיקרופון" description="בדקו שהמכשיר מקליט היטב לפני תרגול או מבחן." />
      <Card className="p-5">
        <MicCheck />
      </Card>
      <div className="mt-6 space-y-2 text-sm text-ink-2">
        <h2 className="font-semibold text-ink">טיפים להקלטה טובה</h2>
        <ul className="list-disc space-y-1 ps-5">
          <li>הקליטו במקום שקט, קרוב למכשיר.</li>
          <li>אוזניות עם מיקרופון משפרות את איכות ההקלטה.</li>
          <li>באייפון — השתמשו ב־Safari, וודאו שהגישה למיקרופון מאושרת (הגדרות ← Safari ← מיקרופון).</li>
          <li>אל תסגרו את הדף בזמן שמירת הקלטה. אם החיבור נקטע — ההקלטה נשמרת במכשיר ותועלה כשהחיבור יחזור.</li>
        </ul>
      </div>
    </>
  );
}
