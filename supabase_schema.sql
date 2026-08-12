-- NOORANI CARGO | Supabase PostgreSQL Schema
-- Migration from SQLite to PostgreSQL

-- 1. Shipments Table
CREATE TABLE IF NOT EXISTS shipments (
    "trackingId" TEXT PRIMARY KEY,
    "ref" TEXT,
    "shippingNumber" TEXT,
    "date" TEXT,
    "sender" TEXT,
    "senderPhone" TEXT,
    "senderAddress" TEXT,
    "originCountry" TEXT,
    "origin" TEXT,
    "receiver" TEXT,
    "receiverPhone" TEXT,
    "receiverAddress" TEXT,
    "destination" TEXT,
    "destinationCountry" TEXT,
    "shipmentType" TEXT,
    "weight" NUMERIC,
    "quantity" INTEGER,
    "shippingCost" NUMERIC,
    "paymentStatus" TEXT DEFAULT 'Unpaid',
    "status" TEXT DEFAULT 'Pending',
    "author" TEXT,
    "driver" TEXT,
    "vehicle" TEXT,
    "branchCode" TEXT,
    "notes" TEXT,
    "public" INTEGER DEFAULT 1,
    "source" TEXT DEFAULT 'manual',
    "swbSerial" TEXT,
    "customerInvoice" TEXT,
    "swbDate" TEXT,
    "statusDate" TEXT,
    "paidDate" TEXT,
    "originalWeight" NUMERIC,
    "originalQuantity" INTEGER,
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
    "branchCode" TEXT,
    "status" TEXT DEFAULT 'enabled',
    "permissions" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    "id" TEXT PRIMARY KEY,
    "type" TEXT CHECK (type IN ('income', 'expense')),
    "category" TEXT,
    "description" TEXT,
    "amount" NUMERIC,
    "date" TEXT,
    "paymentMethod" TEXT,
    "status" TEXT DEFAULT 'Paid',
    "shipmentRef" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    "id" TEXT PRIMARY KEY,
    "invoiceNumber" TEXT UNIQUE NOT NULL,
    "trackingId" TEXT REFERENCES shipments("trackingId"),
    "amount" NUMERIC,
    "currency" TEXT DEFAULT 'SAR',
    "status" TEXT DEFAULT 'issued',
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Shipment Timeline
CREATE TABLE IF NOT EXISTS shipment_timeline (
    "id" BIGSERIAL PRIMARY KEY,
    "trackingNumber" TEXT NOT NULL REFERENCES shipments("trackingId") ON DELETE CASCADE,
    "eventType" TEXT,
    "title" TEXT,
    "description" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Shipment Notes
CREATE TABLE IF NOT EXISTS shipment_notes (
    "id" BIGSERIAL PRIMARY KEY,
    "trackingNumber" TEXT NOT NULL REFERENCES shipments("trackingId") ON DELETE CASCADE,
    "content" TEXT,
    "author" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. System Settings
CREATE TABLE IF NOT EXISTS settings (
    "category" TEXT NOT NULL,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (category, setting_key)
);

-- 8. Uploaded Files
CREATE TABLE IF NOT EXISTS uploaded_files (
    "id" BIGSERIAL PRIMARY KEY,
    "trackingId" TEXT REFERENCES shipments("trackingId") ON DELETE CASCADE,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" BIGINT,
    "assetType" TEXT,
    "upload_date" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. Audit Logs
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

-- 10. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    "id" BIGSERIAL PRIMARY KEY,
    "title" TEXT,
    "message" TEXT,
    "type" TEXT,
    "link" TEXT,
    "recipientUid" TEXT,
    "read" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_timeline_tracking ON shipment_timeline("trackingNumber");
CREATE INDEX IF NOT EXISTS idx_notes_tracking ON shipment_notes("trackingNumber");
CREATE INDEX IF NOT EXISTS idx_files_tracking ON uploaded_files("trackingId");
