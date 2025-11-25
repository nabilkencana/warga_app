/*
  Warnings:

  - You are about to drop the column `metadata` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `provider` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `providerRef` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the column `transactionId` on the `payments` table. All the data in the column will be lost.
  - The `status` column on the `payments` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `isIncome` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `method` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `note` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `transactions` table. All the data in the column will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `description` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dueDate` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `method` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'TREASURER', 'MEMBER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'QRIS', 'MOBILE_BANKING', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');

-- DropForeignKey
ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_userId_fkey";

-- DropForeignKey
ALTER TABLE "activity_logs" DROP CONSTRAINT "activity_logs_adminId_fkey";

-- DropForeignKey
ALTER TABLE "admin_dashboards" DROP CONSTRAINT "admin_dashboards_adminId_fkey";

-- DropForeignKey
ALTER TABLE "emergencies" DROP CONSTRAINT "emergencies_userId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_userId_fkey";

-- DropForeignKey
ALTER TABLE "volunteers" DROP CONSTRAINT "volunteers_userId_fkey";

-- DropIndex
DROP INDEX "payments_transactionId_key";

-- AlterTable
ALTER TABLE "admin_dashboards" ADD COLUMN     "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "paidMembers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalExpense" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalTransactions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unpaidMembers" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "metadata",
DROP COLUMN "provider",
DROP COLUMN "providerRef",
DROP COLUMN "transactionId",
ADD COLUMN     "bankReference" TEXT,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "dueDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "method" "PaymentMethod" NOT NULL,
ADD COLUMN     "paidDate" TIMESTAMP(3),
ADD COLUMN     "qrCode" TEXT,
ADD COLUMN     "receiptImage" TEXT,
ADD COLUMN     "userId" INTEGER NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
DROP COLUMN "status",
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "isIncome",
DROP COLUMN "method",
DROP COLUMN "note",
DROP COLUMN "status",
DROP COLUMN "title",
ADD COLUMN     "createdBy" INTEGER NOT NULL,
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "paymentId" INTEGER,
ADD COLUMN     "proofImage" TEXT,
ADD COLUMN     "type" "TransactionType" NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "userId" DROP NOT NULL;

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "namaLengkap" TEXT NOT NULL,
    "nik" TEXT NOT NULL,
    "tanggalLahir" TIMESTAMP(3) NOT NULL,
    "tempatLahir" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nomorTelepon" TEXT NOT NULL,
    "instagram" TEXT,
    "facebook" TEXT,
    "alamat" TEXT NOT NULL,
    "kota" TEXT NOT NULL,
    "negara" TEXT NOT NULL DEFAULT 'Indonesia',
    "kodePos" TEXT NOT NULL,
    "rtRw" TEXT NOT NULL,
    "kkFile" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "fotoProfil" TEXT,
    "bio" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "language" TEXT NOT NULL DEFAULT 'id',
    "biometricData" TEXT,
    "otpCode" TEXT,
    "otpExpire" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_payments" (
    "id" SERIAL NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "paymentId" INTEGER,

    CONSTRAINT "member_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_summaries" (
    "id" SERIAL NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalExpense" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_reports" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "fileUrl" TEXT,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_nik_key" ON "users"("nik");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "member_payments_paymentId_key" ON "member_payments"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "member_payments_userId_month_year_key" ON "member_payments"("userId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "financial_summaries_month_year_key" ON "financial_summaries"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_categories_name_key" ON "transaction_categories"("name");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payments" ADD CONSTRAINT "member_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payments" ADD CONSTRAINT "member_payments_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_summaries" ADD CONSTRAINT "financial_summaries_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_reports" ADD CONSTRAINT "financial_reports_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergencies" ADD CONSTRAINT "emergencies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_dashboards" ADD CONSTRAINT "admin_dashboards_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
