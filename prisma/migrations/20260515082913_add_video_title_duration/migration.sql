/*
  Warnings:

  - Added the required column `duration` to the `videos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "duration" INTEGER NOT NULL;
