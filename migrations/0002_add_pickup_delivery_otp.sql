-- Add pickup_otp and delivery_otp columns to deliveries table
-- Remove old single 'otp' column if it exists
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "pickup_otp" text;
ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "delivery_otp" text;
ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "otp";

