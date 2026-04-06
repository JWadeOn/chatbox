ALTER TABLE "apps" ADD COLUMN IF NOT EXISTS "approval_status" varchar(20) DEFAULT 'pending' NOT NULL;
UPDATE "apps" SET "approval_status" = 'approved' WHERE "status" = 'active' AND "approval_status" = 'pending';
UPDATE "apps" SET "approval_status" = 'disabled' WHERE "status" = 'inactive';
