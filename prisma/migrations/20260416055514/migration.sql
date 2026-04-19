/*
  Warnings:

  - Added the required column `video_url` to the `videos` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "video_url" TEXT NOT NULL,
ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "external_job_id" DROP NOT NULL,
ALTER COLUMN "thumbnail" DROP NOT NULL;
