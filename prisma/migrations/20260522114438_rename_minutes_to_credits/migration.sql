/*
  Warnings:

  - You are about to drop the column `minutes_used` on the `subscriptions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "minutes_used",
ADD COLUMN     "credits_used" DOUBLE PRECISION NOT NULL DEFAULT 0;
