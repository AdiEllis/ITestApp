# הפעלת "התחברות עם Google" (הגדרה חד־פעמית, כ־10 דקות)

כל עוד ההגדרה הזו לא בוצעה, האתר עובד עם שם משתמש וסיסמה. אחרי שמסיימים, מופיע אוטומטית כפתור "התחברות עם Google".

**כתובת האתר שלך:** `https://lite-kappa-snowy.vercel.app`. אם שינית את שם הפרויקט ב־Vercel, השתמשי בכתובת החדשה בכל מקום שכתוב בו כתובת האתר.

## 1. פרויקט ב־Google Cloud
1. נכנסים ל־**console.cloud.google.com** עם חשבון ה־Gmail ומאשרים את התנאים.
2. למעלה לוחצים **Select a project** ← **New Project**.
3. בשם הפרויקט כותבים `OralPrep` ולוחצים **Create**. מחכים כמה שניות ובוחרים בפרויקט שנוצר.

## 2. מסך ההסכמה (מה שהתלמידים רואים)
1. בתפריט ☰ בוחרים **APIs & Services** ← **OAuth consent screen**. בגרסאות חדשות זה נקרא **Google Auth Platform**. לוחצים **Get started**.
2. ממלאים:
   - **App name:** `OralPrep`.
   - **User support email:** המייל שלך.
3. לוחצים **Next**.
4. בשדה **Audience** בוחרים **External** ולוחצים **Next**.
5. בשדה **Contact information** כותבים את המייל שלך ולוחצים **Next**. מסמנים את האישור ולוחצים **Create**.
6. נכנסים ל־**Audience** (או **Publishing status**) ולוחצים **Publish app** ← **Confirm**.

   **בלי השלב הזה רק את תוכלי להתחבר.** האתר מבקש רק שם ומייל, ולכן Google לא דורשת אימות נוסף.

## 3. יצירת מפתח
1. נכנסים ל־**Clients** (או **Credentials** ← **Create Credentials** ← **OAuth client ID**).
2. ממלאים:
   - **Application type:** **Web application**.
   - **Name:** `OralPrep`.
   - תחת **Authorized redirect URIs** לוחצים **Add URI** ומדביקים:
     `https://lite-kappa-snowy.vercel.app/api/auth/google/callback`
3. לוחצים **Create**. מופיעים שני ערכים: **Client ID** ו־**Client secret**. מעתיקים את שניהם.

## 4. הדבקה ב־Vercel
1. בפרויקט נכנסים ל־**Settings** ← **Environment Variables**.
2. מוסיפים שני משתנים:
   - `GOOGLE_CLIENT_ID`: ה־Client ID.
   - `GOOGLE_CLIENT_SECRET`: ה־Client secret.
3. לוחצים **Save**, ואז **Deployments** ← **⋯** ← **Redeploy**.

## בדיקה
1. בדף ההתחברות מופיע עכשיו הכפתור "התחברות עם Google".
2. מורה חדשה נרשמת דרך "פתיחת חשבון מורה" ← "הרשמה עם Google".
3. תלמידים מצטרפים דרך קישור הכיתה ← "הצטרפות עם Google".

**מורה שכבר נרשמה עם מייל וסיסמה** יכולה להתחבר עם Google, בתנאי שזה אותו מייל. החשבון מתחבר אליה לבד.

## תקלות נפוצות
- **`redirect_uri_mismatch`:** הכתובת בשלב 3 לא זהה בדיוק לכתובת האתר. בודקים https, את שם האתר ואת הסיומת `/api/auth/google/callback`.
- **"Access blocked" / "This app is blocked":** האפליקציה לא פורסמה (שלב 2.6), או שזה חשבון Google של בית הספר שהמנהל חוסם בו אתרים חיצוניים. אפשר להשתמש ב־Gmail אישי, או ב"אין לי חשבון Google" בדף ההצטרפות.
- **הקישור נפתח בתוך וואטסאפ או אינסטגרם:** Google חוסמת התחברות בתוך אפליקציות. פותחים את הקישור בדפדפן.
