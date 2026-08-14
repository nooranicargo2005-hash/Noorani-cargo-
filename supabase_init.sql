-- =====================================================
-- NOORANI CARGO | Enterprise Database Initialization
-- Consolidated: 2026-08-14
-- =====================================================

-- 1. Shipments Table (Modern Core Schema)
CREATE TABLE IF NOT EXISTS shipments (
    "swbSerial" TEXT PRIMARY KEY,
    "custInvNo" TEXT,
    "swbDate" TEXT,
    "customer" TEXT,
    "customerInvNo" TEXT,
    "shipperName" TEXT,
    "shipperPhone" TEXT,
    "shipperAddress" TEXT,
    "consigneeName" TEXT,
    "consigneePhone" TEXT,
    "consigneeCity" TEXT,
    "consigneeAddress" TEXT,
    "origin" TEXT,
    "destination" TEXT,
    "originCountry" TEXT,
    "destinationCountry" TEXT,
    "shippingCost" NUMERIC DEFAULT 0.0,
    "paymentStatus" TEXT DEFAULT 'Unpaid',
    "status" TEXT DEFAULT 'Created',
    "manifestNo" TEXT,
    "assignedTo" TEXT,
    "expectedDelivery" TEXT,
    "notes" TEXT,
    "type" TEXT DEFAULT 'SWB',
    "origQty" INTEGER DEFAULT 0,
    "origWt" NUMERIC DEFAULT 0.0,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shipments_serial ON shipments("swbSerial");
CREATE INDEX IF NOT EXISTS idx_shipments_customer ON shipments(customer);
CREATE INDEX IF NOT EXISTS idx_shipments_date ON shipments("swbDate");
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments("status");
CREATE INDEX IF NOT EXISTS idx_shipments_manifest ON shipments("manifestNo");

-- LEGACY SUPPORT: Ensure 'swbs' table exists or is compatible if shipments is not used
-- Note: The API handles mapping between these schemas.
CREATE TABLE IF NOT EXISTS swbs (
    "swbSerial" TEXT PRIMARY KEY,
    "custInvNo" TEXT,
    "swbDate" TEXT,
    "customer" TEXT,
    "shipperName" TEXT,
    "shipperPhone" TEXT,
    "shipperAddress" TEXT,
    "consignee" TEXT,
    "consigneePhone" TEXT,
    "consigneeAddress" TEXT,
    "origin" TEXT,
    "destination" TEXT,
    "status" TEXT DEFAULT 'Created',
    "manifestNo" TEXT,
    "notes" TEXT,
    "origQty" INTEGER DEFAULT 0,
    "origWt" NUMERIC DEFAULT 0.0,
    "type" TEXT DEFAULT 'SWB',
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Status History Table (Timeline Tracking)
CREATE TABLE IF NOT EXISTS status_history (
    "id" BIGSERIAL PRIMARY KEY,
    "swbSerial" TEXT REFERENCES shipments("swbSerial") ON DELETE CASCADE,
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

-- 3.1 Manifest Files / File Manager
CREATE TABLE IF NOT EXISTS manifest_files (
    "id" BIGSERIAL PRIMARY KEY,
    "manifestNo" TEXT REFERENCES manifests("manifestNo") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "parent_id" BIGINT REFERENCES manifest_files("id") ON DELETE CASCADE,
    "type" TEXT NOT NULL CHECK ("type" IN ('file', 'folder')),
    "content" TEXT, -- For text-based files
    "storage_path" TEXT, -- For binary uploads
    "size" BIGINT DEFAULT 0,
    "mime_type" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Users Table (RBAC / Profiles)
CREATE TABLE IF NOT EXISTS users (
    "id" BIGSERIAL PRIMARY KEY,
    "displayName" TEXT,
    "email" TEXT UNIQUE NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT DEFAULT 'employee',
    "status" TEXT DEFAULT 'enabled',
    "permissions" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    "id" BIGSERIAL PRIMARY KEY,
    "action" TEXT,
    "details" TEXT,
    "module" TEXT,
    "actorEmail" TEXT,
    "actorName" TEXT,
    "actorRole" TEXT,
    "deviceInfo" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDICES & PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_shipments_customer ON shipments(customer);
CREATE INDEX IF NOT EXISTS idx_shipments_date ON shipments("swbDate");
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments("status");
CREATE INDEX IF NOT EXISTS idx_shipments_manifest ON shipments("manifestNo");
CREATE INDEX IF NOT EXISTS idx_history_swb ON status_history("swbSerial");
CREATE INDEX IF NOT EXISTS idx_files_manifest ON manifest_files("manifestNo");
CREATE INDEX IF NOT EXISTS idx_files_parent ON manifest_files("parent_id");

-- =====================================================
-- RPC FUNCTIONS
-- =====================================================

-- Helper function for status breakdown stats
CREATE OR REPLACE FUNCTION get_status_counts()
RETURNS TABLE (status TEXT, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT s.status, COUNT(*)
    FROM shipments s
    GROUP BY s.status;
END;
$$ LANGUAGE plpgsql;
