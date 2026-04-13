-- AlterTable
ALTER TABLE "users" ADD COLUMN     "resetPasswordToken" TEXT,
ADD COLUMN     "resetPasswordTokenExp" TIMESTAMP(3);
