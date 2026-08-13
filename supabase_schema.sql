-- NOORANI CARGO | New SWB System PostgreSQL Schema

-- 1. SWB Table (Core Data)
CREATE TABLE IF NOT EXISTS swbs (
    "swbSerial" TEXT PRIMARY KEY,
    "custInvNo" TEXT,
    "swbDate" TEXT,
    "customer" TEXT,
    "customerInvNo" TEXT,
    "shipperName" TEXT,
    "consigneeName" TEXT,
    "origQty" INTEGER DEFAULT 0,
    "origWt" NUMERIC DEFAULT 0.0,
    "consigneeCity" TEXT,
    "consigneeAddress" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table
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

-- 3. Audit Logs
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

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_swbs_customer ON swbs(customer);
CREATE INDEX IF NOT EXISTS idx_swbs_date ON swbs("swbDate");
