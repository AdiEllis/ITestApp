import type { RubricCriterion } from "./exam-types";
import { defaultCobeRubric } from "./cobe";

export const GENERAL_RUBRIC_NAME = "מחוון כללי לתשובה בעל פה";
export const COBE_RUBRIC_NAME = "COBE – מחוון ברירת מחדל";

/** Default rubric for oral answers in any subject. Weights and wording are editable defaults. */
export function generalOralRubric(): RubricCriterion[] {
  const bands = (top: string, good: string, partial: string, weak: string) => [
    { label: "מצוין", min: 76, max: 100, descriptor: top },
    { label: "טוב", min: 51, max: 75, descriptor: good },
    { label: "חלקי", min: 26, max: 50, descriptor: partial },
    { label: "חלש", min: 0, max: 25, descriptor: weak },
  ];
  return [
    {
      key: "content",
      label: "תוכן ודיוק",
      weight: 50,
      description: "התשובה נכונה, עונה על מה שנשאל ומשתמשת בידע מהחומר.",
      bands: bands(
        "התשובה נכונה ומלאה, עם עובדות ומושגים מדויקים מהחומר.",
        "התשובה נכונה ברובה, חסרים פרטים או שיש אי־דיוקים קטנים.",
        "התשובה חלקית, עם טעויות או חוסרים משמעותיים.",
        "התשובה אינה עונה על השאלה או שגויה ברובה.",
      ),
    },
    {
      key: "explanation",
      label: "הסבר והבנה",
      weight: 30,
      description: "התלמיד/ה מסביר/ה, מנמק/ת ונותן/ת דוגמאות, ולא רק מונה עובדות.",
      bands: bands(
        "הסבר ברור ומנומק, עם דוגמאות וקשרים בין רעיונות.",
        "יש הסבר, אך חלק מהנימוקים חסרים או כלליים.",
        "הסבר מועט, בעיקר שינון עובדות.",
        "אין הסבר או נימוק.",
      ),
    },
    {
      key: "organization",
      label: "ארגון ובהירות",
      weight: 20,
      description: "התשובה מסודרת, ברורה ומובנת לשומע/ת.",
      bands: bands(
        "תשובה מסודרת לפי סדר הגיוני, ברורה מההתחלה ועד הסוף.",
        "התשובה מובנת, עם מעט קפיצות או חזרות.",
        "קשה לעקוב אחרי התשובה בחלקים ממנה.",
        "התשובה לא מאורגנת וקשה להבין אותה.",
      ),
    },
  ];
}

export const SYSTEM_RUBRICS = [
  { name: GENERAL_RUBRIC_NAME, description: "לתשובות בעל פה בכל מקצוע. המשקלים והניסוחים ניתנים לשינוי בעותק אישי.", criteria: generalOralRubric },
  { name: COBE_RUBRIC_NAME, description: "קריטריונים לפי המחוונים הציבוריים של ה־COBE. משקלים לעריכה — יש לאמת מול המחוון הרשמי העדכני.", criteria: defaultCobeRubric },
];
