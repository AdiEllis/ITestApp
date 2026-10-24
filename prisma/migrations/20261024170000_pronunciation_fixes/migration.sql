-- CreateTable
CREATE TABLE "PronunciationFix" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "written" TEXT NOT NULL,
    "spoken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PronunciationFix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PronunciationFix_ownerId_written_key" ON "PronunciationFix"("ownerId", "written");

-- AddForeignKey
ALTER TABLE "PronunciationFix" ADD CONSTRAINT "PronunciationFix_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
