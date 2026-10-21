# פריסה לסביבת אמת

> **רוצים בחינם?** ראו [FREE-SETUP.md](FREE-SETUP.md): Vercel + Neon + Backblaze B2, בלי כרטיס אשראי. המסמך הזה מתאר פריסה כללית או בתשלום (Docker, Render, VPS).

המערכת היא אפליקציית Node.js אחת (Next.js) שזקוקה לשלושה רכיבים:

1. **שרת Node.js 20 ומעלה** שרץ ברציפות.
2. **PostgreSQL 14 ומעלה.**
3. **אחסון קבצים פרטי תואם S3.**

## תצורה מומלצת וחסכונית

| רכיב | המלצה | עלות משוערת | למה |
|---|---|---|---|
| אפליקציה | Render (Web Service) או Railway. לחלופין VPS קטן עם Docker | כ־7$ לחודש | תהליך Node רציף. ה־Dockerfile מוכן |
| בסיס נתונים | Neon או Supabase Postgres | חינם עד נפח מסוים, אחר כך כ־19$ לחודש | מנוהל, כולל גיבויים |
| אחסון | Cloudflare R2 | 10GB חינם. אין עלות תעבורה יוצאת | תואם S3. הקלטה של 2 דקות שוקלת כ־1MB, כך ש־10GB מספיקים לכ־10,000 הקלטות |
| משימה יומית | Cron Job ב־Render, או GitHub Actions | חינם | מריצה `npm run retention` |

> **החלטה עסקית שלך:** איפה יישמר המידע (region). ראו `SECURITY-PRIVACY.md`.
>
> Vercel אפשרי טכנית, כי ההעלאות עוברות ישירות מהדפדפן לאחסון ולא דרך השרת. אבל מגבלות מסלול Hobby (שימוש לא מסחרי) ומגבלת 4.5MB לבקשה הופכות את Render או Railway לפשוטים יותר.

## מה נדרש ממך (חשבונות)

1. **Cloudflare:** פתיחת חשבון, R2, יצירת bucket פרטי (למשל `oralprep-media`) ויצירת API token מסוג *Object Read & Write* לאותו bucket. בסוף יהיו בידיך: Account ID, Access Key ID ו־Secret Access Key.
   - הגדרת CORS ל־bucket: להעתיק את `docs/r2-cors.json` ולהחליף את `YOUR-APP-DOMAIN`.
2. **Neon** (או Supabase): יצירת פרויקט ו־database. בסוף יהיה בידיך `DATABASE_URL` (עם `?sslmode=require`).
3. **Render** (או Railway): חיבור ל־GitHub repository ויצירת Web Service מה־Dockerfile.

הפעולות האלה כרוכות בפתיחת חשבונות ואולי בעלות, ולכן לא ביצעתי אותן בעצמי.

## משתני סביבה

לפי `.env.example`:

```
DATABASE_URL=postgresql://...neon.tech/oralprep?sslmode=require
APP_URL=https://oralprep.example.org
APP_SECRET=<48 תווים אקראיים: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))">
ALLOW_TEACHER_SIGNUP=true          # false = רק מנהל פותח חשבונות מורים
STORAGE_DRIVER=s3
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=oralprep-media
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=false
DEFAULT_RECORDING_RETENTION_DAYS=400
```

> **מצב אחסון `local`:** מתאים לפיתוח או לשרת יחיד עם דיסק קבוע (VPS). **לא מתאים** לשירותים שבהם הדיסק נמחק בכל פריסה, כמו Render בלי Persistent Disk.

## צעדי פריסה

1. **פריסת השירות** עם ה־Dockerfile. בכל עלייה הוא מריץ `prisma migrate deploy` ואת ה־seed (שאינו משנה נתונים קיימים), ואז מפעיל את השרת.
2. **יצירת מנהל מערכת ראשון.** פעם אחת, ממסוף השירות:
   ```
   npm run admin:create -- you@school.org.il "השם שלך"
   ```
   הפקודה מדפיסה סיסמה זמנית, ובכניסה הראשונה תתבקש סיסמה חדשה.
3. **משימה יומית:** `npm run retention`, עם אותם משתני סביבה.
4. **בדיקת עשן אחרי פריסה:**
   - הרשמת מורה, יצירת כיתה ומבחן קצר עם סרטון.
   - הקצאה, כניסת תלמיד מטלפון, בדיקת מיקרופון, הקלטה והגשה.
   - האזנה והצגת ציון.
5. **(לא חובה) נתוני הדגמה מסומנים:** `npm run db:demo`. להסרה: `npm run db:demo -- --remove`.

## בדיקות לפני כל גרסה

```
npm run typecheck && npm run lint
npm test                      # unit + integration (צריך TEST_DATABASE_URL או ברירת המחדל cobe_test)
npm run build && npm run test:e2e
E2E_STORAGE=s3 S3_ENDPOINT=http://localhost:9000 ... npm run test:e2e   # אותו סט מול MinIO/S3
```

## גיבוי ושחזור

- **DB:** הגיבויים האוטומטיים של Neon או Supabase. בנוסף מומלץ `pg_dump` שבועי.
- **R2:** מומלץ להפעיל Object versioning, או סנכרון תקופתי ל־bucket שני.
- **לבדוק שחזור** לפחות פעם בסמסטר.
