-- AlterTable
ALTER TABLE "ExamSection" ADD COLUMN     "maxMediaPlays" INTEGER,
ADD COLUMN     "mediaId" TEXT;

-- AddForeignKey
ALTER TABLE "ExamSection" ADD CONSTRAINT "ExamSection_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
