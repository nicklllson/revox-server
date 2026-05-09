-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "voiceGender" TEXT NOT NULL DEFAULT 'female',
ADD COLUMN     "voiceName" TEXT NOT NULL DEFAULT 'anna',
ADD COLUMN     "voiceStyle" TEXT NOT NULL DEFAULT 'neutral';
