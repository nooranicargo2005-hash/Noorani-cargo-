-- NOORANI CARGO | Enterprise Upgrade Schema (Aramex-style)

-- 1. Extend SWB Table for Workflow
ALTER TABLE swbs
ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'Created',
ADD COLUMN IF NOT EXISTS "origin" TEXT,
ADD COLUMN IF NOT EXISTS "destination" TEXT,
ADD COLUMN IF NOT EXISTS "manifestNo" TEXT,
ADD COLUMN IF NOT EXISTS "assignedTo" TEXT,
ADD COLUMN IF NOT EXISTS "expectedDelivery" TEXT,
ADD COLUMN IF NOT EXISTS "notes" TEXT,
ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'General';

-- 2. Status History Table (Timeline)
CREATE TABLE IF NOT EXISTS status_history (
    "id" BIGSERIAL PRIMARY KEY,
    "swbSerial" TEXT REFERENCES swbs("swbSerial") ON DELETE CASCADE,
    "status" TEXT NOT NULL,
    "location" TEXT,
    "remarks" TEXT,
    "actorEmail" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Manifests / Containers
CREATE TABLE IF NOT EXISTS manifests (
    "manifestNo" TEXT PRIMARY KEY,
    "date" TEXT,
    "origin" TEXT,
    "destination" TEXT,
    "containerNo" TEXT,
    "status" TEXT DEFAULT 'Draft',
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Indices for Performance
CREATE INDEX IF NOT EXISTS idx_swbs_status ON swbs("status");
CREATE INDEX IF NOT EXISTS idx_swbs_manifest ON swbs("manifestNo");
CREATE INDEX IF NOT EXISTS idx_history_swb ON status_history("swbSerial");
