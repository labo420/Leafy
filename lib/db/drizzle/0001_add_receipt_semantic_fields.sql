ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "receipt_date" text;
ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "receipt_total" integer;
CREATE INDEX IF NOT EXISTS idx_receipts_semantic_dedup ON receipts (receipt_date, receipt_total);
