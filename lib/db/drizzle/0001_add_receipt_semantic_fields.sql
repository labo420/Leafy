ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "receipt_date" text;
ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "receipt_total" integer;
