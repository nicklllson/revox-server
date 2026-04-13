/*
  Warnings:

  - You are about to drop the column `confirmation_code` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `verification_code` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `verification_code_expires_at` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "confirmation_code",
DROP COLUMN "verification_code",
DROP COLUMN "verification_code_expires_at";
