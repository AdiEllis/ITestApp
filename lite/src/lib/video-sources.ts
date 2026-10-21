/**
 * Places where Israeli English teachers find COBE Part C practice clips.
 * Only the first entry is official; the others are teacher-run collections (not endorsed or verified by us).
 * Shared by the full app and OralPrep Lite.
 */
export const VIDEO_SOURCES = [
  {
    name: "משרד החינוך – דף ה־COBE הרשמי",
    url: "https://pop.education.gov.il/tchumey_daat/english/chativa-elyona/bagrut-exam/cobe-oral-exam/",
    note: "חומרי תרגול והדרכה רשמיים של הפיקוח על האנגלית (סימולציות, קורס הכנה).",
    official: true,
  },
  {
    name: "REED: All You Need – COBE Practice Resources",
    url: "https://sites.google.com/hityash.org/reed/high-school-main-page/cobe-practice-resources",
    note: "אוסף של מורים: קטעים ממבחנים קודמים וקטעי תרגול עם שאלות.",
    official: false,
  },
  {
    name: "Pure English – COBE Practice: Video Clips",
    url: "https://www.purenglish.org.il/high-school/cobe-practice-video-clips",
    note: "סרטוני YouTube (בעיקר TED-Ed) עם שאלות הבנה.",
    official: false,
  },
  {
    name: "Shaked English – COBE Clips",
    url: "https://www.shakedeng.com/cobe-clips",
    note: "רשימת קישורי YouTube עם שאלות לתרגול.",
    official: false,
  },
] as const;
