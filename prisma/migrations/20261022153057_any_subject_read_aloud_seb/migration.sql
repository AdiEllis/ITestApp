-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "requireSeb" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sebKey" TEXT,
ADD COLUMN     "sebQuitPassword" TEXT;

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "subject" TEXT,
ALTER COLUMN "level" SET DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "audioApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "audioSource" TEXT,
ADD COLUMN     "audioText" TEXT,
ADD COLUMN     "readText" TEXT;

-- Existing exams keep working as before: questions without approved audio are read by the device voice,
-- and audio teachers already attached counts as checked.
UPDATE "Exam" SET "settings" = jsonb_set(COALESCE("settings", '{}'::jsonb), '{deviceVoiceFallback}', 'true'::jsonb);
UPDATE "Question" SET "audioApproved" = true, "audioSource" = 'TEACHER' WHERE "audioId" IS NOT NULL;
