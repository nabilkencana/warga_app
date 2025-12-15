/*
  Warnings:

  - A unique constraint covering the columns `[emergencyId,satpamId]` on the table `emergency_responses` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `security_personnel` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SatpamResponseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'ARRIVED', 'HANDLING', 'RESOLVED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SATPAM';

-- AlterTable
ALTER TABLE "emergencies" ADD COLUMN     "needSatpam" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "satpamAlertSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "satpamAlertSentAt" TIMESTAMP(3),
ADD COLUMN     "satpamAssigned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "emergency_responses" ADD COLUMN     "satpamArrivedAt" TIMESTAMP(3),
ADD COLUMN     "satpamCompletedAt" TIMESTAMP(3),
ADD COLUMN     "satpamId" INTEGER,
ADD COLUMN     "satpamStatus" "SatpamResponseStatus" DEFAULT 'PENDING',
ALTER COLUMN "securityId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "security_personnel" ADD COLUMN     "userId" INTEGER;

-- CreateIndex
CREATE INDEX "emergencies_needSatpam_idx" ON "emergencies"("needSatpam");

-- CreateIndex
CREATE INDEX "emergencies_satpamAssigned_idx" ON "emergencies"("satpamAssigned");

-- CreateIndex
CREATE INDEX "emergency_responses_satpamId_idx" ON "emergency_responses"("satpamId");

-- CreateIndex
CREATE INDEX "emergency_responses_satpamStatus_idx" ON "emergency_responses"("satpamStatus");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_responses_emergencyId_satpamId_key" ON "emergency_responses"("emergencyId", "satpamId");

-- CreateIndex
CREATE UNIQUE INDEX "security_personnel_userId_key" ON "security_personnel"("userId");

-- CreateIndex
CREATE INDEX "security_personnel_userId_idx" ON "security_personnel"("userId");

-- AddForeignKey
ALTER TABLE "security_personnel" ADD CONSTRAINT "security_personnel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_responses" ADD CONSTRAINT "emergency_responses_satpamId_fkey" FOREIGN KEY ("satpamId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
