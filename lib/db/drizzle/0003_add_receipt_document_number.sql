ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "document_number" text;
CREATE INDEX IF NOT EXISTS idx_receipts_document_number ON receipts (document_number);
