/**
 * NOORANI CARGO ENTERPRISE API
 * Version: 2.9.6
 * Updated: 2026-08-14 (Legacy Table Compatibility: swbs)
 *
 * Central API for global logistics management.
 */

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// =====================================================
// ENVIRONMENT & SECURITY
// =====================================================

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
const IS_DEMO = !SUPABASE_URL || SUPABASE_URL.includes("dummy");

const allowedOrigins = [
  "https://noorani-cargo-admin-2005.web.app",
  "https://noorani-cargo-admin-2005.firebaseapp.com",
  "https://noorani-cargo-tracking-2005.web.app",
  "https://noorani-cargo-tracking-2005.firebaseapp.com",
  "http://localhost:3000",
  "http://localhost:5000",
  "http://localhost:5173",
  "http://localhost:10000",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5001",
  "http://localhost:10005"
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow if no origin (server-to-server) or in whitelist or local
    if (!origin || allowedOrigins.includes(origin) || origin.includes("localhost") || origin.includes("127.0.0.1") || origin.includes("web.app") || origin.includes("firebaseapp.com")) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

// Global Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

// =====================================================
// SUPABASE CLIENT
// =====================================================

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith("http")) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  console.log("[System] Supabase initialized.");
}

function requireSupabase(req, res, next) {
  if (IS_DEMO) return next();
  if (!supabase) return res.status(503).json({ success: false, error: "Database not configured." });
  next();
}

let activeTableCache = { table: null, expiry: 0 };

async function getActiveTable() {
  if (IS_DEMO || !supabase) return "shipments";
  if (activeTableCache.table && activeTableCache.expiry > Date.now()) return activeTableCache.table;

  try {
    // Probe for shipments AND modern columns
    const { error } = await supabase.from("shipments").select("consigneeName").limit(1);
    if (error && (error.message.includes("does not exist") || error.code === '42P01' || error.message.includes("consigneeName"))) {
      activeTableCache = { table: "swbs", expiry: Date.now() + 300000 };
      return "swbs";
    }
    activeTableCache = { table: "shipments", expiry: Date.now() + 300000 };
  } catch (e) {
    console.error("[System] getActiveTable probe failed:", e.message);
  }
  return "shipments";
}

function cleanObject(obj) {
  const res = {};
  for (const [k, v] of Object.entries(obj || {})) if (v !== undefined && v !== null) res[k] = v;
  return res;
}

// =====================================================
// SCHEMA WHITELISTS
// =====================================================

const SWBS_WHITELIST = [
  'swbSerial', 'custInvNo', 'swbDate', 'customer', 'shipperName', 'shipperPhone', 'shipperAddress',
  'consignee', 'consigneePhone', 'consigneeAddress', 'origin', 'destination', 'status',
  'manifestNo', 'notes', 'origQty', 'origWt', 'type', 'created_at', 'updated_at'
];

const SHIPMENTS_WHITELIST = [
  'swbSerial', 'customerInvNo', 'custInvNo', 'swbDate', 'customer', 'shipperName', 'shipperPhone', 'shipperAddress',
  'consigneeName', 'consigneePhone', 'consigneeAddress', 'consigneeCity', 'origin', 'destination',
  'status', 'manifestNo', 'notes', 'origQty', 'origWt', 'type', 'assignedTo',
  'expectedDelivery', 'shippingCost', 'paymentStatus', 'originCountry', 'destinationCountry',
  'created_at', 'updated_at'
];

let tableSchemas = { swbs: [], shipments: [], manifests: [], manifest_files: [] };

async function discoverSchema() {
  if (IS_DEMO || !supabase) return;
  const tables = ['swbs', 'shipments', 'manifests', 'manifest_files', 'status_history', 'users'];
  for (const table of tables) {
    try {
      // PostgREST trick: select one row, then check keys.
      // If empty, we can try to probe via an error by selecting a non-existent column? No.
      // Better: Use a view or information_schema if possible, but Supabase JS restricts this.
      // Final fallback: try to select ALL known fields and see which ones fail? Too many requests.

      // Let's try to get ONE row to see columns.
      const { data, error } = await supabase.from(table).select("*").limit(1);
      if (!error && data && data[0]) {
        tableSchemas[table] = Object.keys(data[0]);
        console.log(`[Schema] Discovered ${table}:`, tableSchemas[table]);
      } else {
        // If empty, we don't know columns. We'll have to be defensive.
        console.log(`[Schema] ${table} is empty, using defensive defaults.`);
      }
    } catch (e) {
      console.warn(`[Schema] Discovery failed for ${table}:`, e.message);
    }
  }
}

// Run discovery on start and periodically
setTimeout(discoverSchema, 5000);
setInterval(discoverSchema, 300000);

/**
 * Attempts a Supabase operation. If it fails due to a missing column,
 * it re-maps and retries. This handles out-of-sync database schemas.
 */
async function selfHealingUpsert(table, records, onConflict, depth = 0, lastDbError = null) {
  if (depth > 25) {
    return { error: `Self-healing recursion limit reached for ${table}`, success: false, lastDbError, depth };
  }

  try {
    const { data, error } = await supabase.from(table).upsert(records, { onConflict }).select("swbSerial");
    if (error) {
      console.log(`[Self-Heal][${depth}] DB Error for ${table}:`, error.message);

      // Match column error: "Could not find the 'column_name' column..."
      const colMatch = error.message.match(/find the '(.*?)' column/i) || error.message.match(/column "(.*?)"/i);

      if (colMatch && colMatch[1]) {
        const col = colMatch[1];
        console.warn(`[Self-Heal][${depth}] Column ${col} missing from ${table}. Stripping and retrying...`);
        const reMapped = records.map(r => {
          const clean = { ...r };
          delete clean[col];
          return clean;
        });
        return selfHealingUpsert(table, reMapped, onConflict, depth + 1, error.message);
      }
      throw error;
    }
    return { data, success: true };
  } catch (e) {
    console.error(`[Self-Heal] Final Failure for ${table}:`, e.message);
    return { error: e.message, success: false, lastDbError, depth };
  }
}

/**
 * Standardizes record for Supabase based on the active table schema.
 * Handles legacy 'swbs' vs modern 'shipments' column names.
 * DYNAMICALLY FILTERS BASED ON DISCOVERED SCHEMA OR DEFENSIVE WHITELISTS.
 */
function mapToTableSchema(item, isLegacy, table) {
  const discovered = tableSchemas[table] || [];
  const hardWhitelists = {
    swbs: SWBS_WHITELIST,
    shipments: SHIPMENTS_WHITELIST
  };
  const whitelist = discovered.length > 0 ? discovered : (hardWhitelists[table] || []);

  const rawRecord = {
    swbSerial: String(item.swbSerial || "").trim(),
    custInvNo: item.custInvNo || item.customerInvNo,
    customerInvNo: item.customerInvNo || item.custInvNo,
    swbDate: item.swbDate,
    customer: item.customer,
    shipperName: item.shipperName,
    shipperPhone: item.shipperPhone,
    shipperAddress: item.shipperAddress,
    consigneePhone: item.consigneePhone,
    consigneeAddress: item.consigneeAddress,
    origin: item.origin,
    status: item.status || "Created",
    manifestNo: item.manifestNo,
    notes: item.notes,
    origQty: parseInt(item.origQty) || 0,
    origWt: parseFloat(item.origWt) || 0,
    type: item.type || "SWB",
    assignedTo: item.assignedTo,
    expectedDelivery: item.expectedDelivery,
    shippingCost: item.shippingCost ? parseFloat(item.shippingCost) : undefined,
    paymentStatus: item.paymentStatus,
    originCountry: item.originCountry,
    destinationCountry: item.destinationCountry,
    created_at: item.created_at
  };

  if (isLegacy) {
    rawRecord.consignee = item.consigneeName || item.consignee;
    rawRecord.destination = item.destination || item.consigneeCity;
  } else {
    rawRecord.consigneeName = item.consigneeName;
    rawRecord.consigneeCity = item.consigneeCity;
    rawRecord.destination = item.destination;
  }

  // Strict filtering: ONLY include keys that exist in the database (discovered or whitelist)
  const filteredRecord = {};
  whitelist.forEach(key => {
    if (rawRecord[key] !== undefined && rawRecord[key] !== null) {
      filteredRecord[key] = rawRecord[key];
    }
  });

  return filteredRecord;
}

/**
 * Standardizes output from Supabase to match modern schema.
 * Ensures 'consigneeName' and 'consigneeCity' are always present.
 */
function mapFromTableSchema(item, isLegacy) {
  if (!item) return item;
  if (isLegacy) {
    item.consigneeName = item.consigneeName || item.consignee;
    item.consigneeCity = item.consigneeCity || item.destination;
    item.customerInvNo = item.customerInvNo || item.custInvNo;
  }
  return item;
}

// =====================================================
// FLATTENED API ROUTES (No Router Middleware for Max Compatibility)
// =====================================================

// 1. Health & Debug
app.get("/api/health", requireSupabase, async (req, res) => {
  try {
    const table = await getActiveTable();
    res.json({ success: true, status: "healthy", table, databaseReachable: !!supabase });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post("/api/admin/initialize-db", requireSupabase, async (req, res) => {
  try {
    const sql = `
      -- Attempt to create shipments if missing
      CREATE TABLE IF NOT EXISTS shipments (
          "swbSerial" TEXT PRIMARY KEY,
          "consigneeName" TEXT,
          "consigneeCity" TEXT,
          "status" TEXT DEFAULT 'Created',
          "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      -- Add missing columns to swbs if legacy
      ALTER TABLE swbs ADD COLUMN IF NOT EXISTS "consignee" TEXT;
      ALTER TABLE swbs ADD COLUMN IF NOT EXISTS "destination" TEXT;
    `;
    // Note: Supabase JS cannot run raw SQL easily without a custom RPC.
    // We will attempt to probe and report.
    res.json({ success: false, message: "Manual SQL execution required in Supabase Editor. Use supabase_init.sql." });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 2. Shipment Management (Inventory)
const getAllShipments = async (req, res) => {
  try {
    if (IS_DEMO) {
      const items = [{ swbSerial: "NOORANI-DEMO-001", customer: "Demo User", status: "In Transit", origin: "Dubai", consigneeCity: "London", created_at: new Date().toISOString() }];
      return res.json({ success: true, count: items.length, items });
    }
    const search = String(req.query.search || "").trim();
    const { status, origin, destination, manifestNo, limit } = req.query;
    const table = await getActiveTable();
    const isLegacy = table === 'swbs';
    const whitelist = isLegacy ? SWBS_WHITELIST : SHIPMENTS_WHITELIST;

    let q = supabase.from(table).select(whitelist.join(',')).order("created_at", { ascending: false });

    if (search) {
      const s = search.replace(/,/g, " ");
      const cityCol = isLegacy ? 'destination' : 'consigneeCity';
      const consigneeCol = isLegacy ? 'consignee' : 'consigneeName';
      q = q.or(`swbSerial.ilike.%${s}%,customer.ilike.%${s}%,shipperName.ilike.%${s}%,${consigneeCol}.ilike.%${s}%,${cityCol}.ilike.%${s}%`);
    }
    if (status && status !== "") q = q.eq("status", status);
    if (origin && origin !== "") q = q.ilike("origin", `%${origin}%`);
    if (destination && destination !== "") {
        const cityCol = isLegacy ? 'destination' : 'consigneeCity';
        q = q.ilike(cityCol, `%${destination}%`);
    }
    if (manifestNo && manifestNo !== "") q = q.eq("manifestNo", manifestNo);

    if (limit) {
      const l = parseInt(limit);
      if (!isNaN(l) && l > 0) q = q.limit(l);
    }

    const { data, error } = await q;
    if (error) throw error;
    const items = (data || []).map(item => mapFromTableSchema(item, isLegacy));
    res.json({ success: true, count: items.length, items });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

app.get("/api/shipments", requireSupabase, getAllShipments);
app.get("/api/shipments/", requireSupabase, getAllShipments); // Trailing slash fallback
app.get("/api/swbs", requireSupabase, getAllShipments);

// 3. Shipment Details & CRUD
app.get("/api/shipments/:serial", requireSupabase, async (req, res) => {
  try {
    const table = await getActiveTable();
    const isLegacy = table === 'swbs';
    const whitelist = isLegacy ? SWBS_WHITELIST : SHIPMENTS_WHITELIST;

    const { data, error } = await supabase.from(table).select(whitelist.join(',')).eq("swbSerial", req.params.serial).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: "Shipment not found" });
    res.json({ success: true, data: mapFromTableSchema(data, isLegacy) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post("/api/shipments/:serial", requireSupabase, async (req, res) => {
  try {
    const serial = req.params.serial;
    const table = await getActiveTable();
    const isLegacy = table === 'swbs';

    const record = mapToTableSchema(req.body, isLegacy, table);
    if (serial) record.swbSerial = serial;
    record.updated_at = new Date().toISOString();

    const { data: existing } = await supabase.from(table).select("status").eq("swbSerial", serial).maybeSingle();
    const { success, data, error } = await selfHealingUpsert(table, [record], 'swbSerial');
    if (!success) throw new Error(error);

    if (!existing || existing.status !== record.status) {
      await supabase.from("status_history").insert({
        swbSerial: serial,
        status: record.status,
        remarks: existing ? "Status updated" : "Shipment created",
        actorEmail: req.body.actorEmail || "system"
      });
    }
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete("/api/shipments/:serial", requireSupabase, async (req, res) => {
  try {
    const table = await getActiveTable();
    await supabase.from("status_history").delete().eq("swbSerial", req.params.serial);
    const { error } = await supabase.from(table).delete().eq("swbSerial", req.params.serial);
    if (error) throw error;
    res.json({ success: true, message: "Deleted" });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 4. Bulk Updates
app.post("/api/shipments/bulk/import", requireSupabase, async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!items || !Array.isArray(items)) return res.status(400).json({ success: false, error: "Invalid bulk data" });
    const table = await getActiveTable();
    const isLegacy = table === 'swbs';

    const records = items
      .filter(i => i.swbSerial)
      .map(item => mapToTableSchema(item, isLegacy, table));

    if (records.length === 0) return res.json({ success: true, count: 0 });

    if (IS_DEMO) {
      return res.json({ success: true, count: records.length, message: "Demo mode: Records simulated." });
    }

    const { success, data, error } = await selfHealingUpsert(table, records, 'swbSerial');
    if (!success) throw new Error(error);
    res.json({ success: true, count: data?.length || 0 });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post("/api/shipments/bulk/status", requireSupabase, async (req, res) => {
  try {
    const { ids, status, remarks, actorEmail } = req.body || {};
    if (!ids || !Array.isArray(ids) || !status) return res.status(400).json({ success: false, error: "Invalid bulk data" });
    const table = await getActiveTable();
    const { error } = await supabase.from(table).update({ status }).in("swbSerial", ids);
    if (error) throw error;
    const history = ids.map(id => ({ swbSerial: id, status, remarks: remarks || "Bulk status update", actorEmail: actorEmail || "system" }));
    await supabase.from("status_history").insert(history);
    res.json({ success: true, message: `Updated ${ids.length} shipments.` });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 5. Tracking & History
app.get("/api/tracking/:serial", requireSupabase, async (req, res) => {
  try {
    const table = await getActiveTable();
    const isLegacy = table === 'swbs';
    const whitelist = isLegacy ? SWBS_WHITELIST : SHIPMENTS_WHITELIST;

    const { data: shipment, error } = await supabase.from(table).select(whitelist.join(',')).eq("swbSerial", req.params.serial).maybeSingle();
    if (error || !shipment) return res.status(404).json({ success: false, error: "Not identified" });
    const { data: history } = await supabase.from("status_history").select("*").eq("swbSerial", req.params.serial).order("created_at", { ascending: true });
    res.json({ success: true, shipment: mapFromTableSchema(shipment, isLegacy), history: history || [] });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get("/api/shipments/:serial/history", requireSupabase, async (req, res) => {
  try {
    const { data, error } = await supabase.from("status_history").select("*").eq("swbSerial", req.params.serial).order("created_at", { ascending: true });
    res.json({ success: true, data: data || [] });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 6. Manifests
app.get("/api/manifests", requireSupabase, async (req, res) => {
  try {
    const table = await getActiveTable();
    // Fetch manifests and calculate stats
    const { data: manifests, error: mError } = await supabase.from("manifests").select("*").order("created_at", { ascending: false });
    if (mError) throw mError;

    // Fetch stats per manifest
    const { data: stats, error: sError } = await supabase.from(table).select("manifestNo, origQty, origWt");
    if (sError) throw sError;

    const items = manifests.map(m => {
      const related = stats.filter(s => s.manifestNo === m.manifestNo);
      return {
        ...m,
        totalShipments: related.length,
        totalQty: related.reduce((sum, r) => sum + (r.origQty || 0), 0),
        totalWt: related.reduce((sum, r) => sum + (r.origWt || 0), 0)
      };
    });

    res.json({ success: true, data: items });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get("/api/manifests/:id", requireSupabase, async (req, res) => {
  try {
    const { data, error } = await supabase.from("manifests").select("*").eq("manifestNo", req.params.id).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: "Manifest not found" });

    const table = await getActiveTable();
    const { data: shipments, error: sError } = await supabase.from(table).select("*").eq("manifestNo", req.params.id);
    if (sError) throw sError;

    res.json({
      success: true,
      data: {
        ...data,
        shipments: shipments.map(s => mapFromTableSchema(s, table === 'swbs'))
      }
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post("/api/manifests", requireSupabase, async (req, res) => {
  try {
    const { data, error } = await supabase.from("manifests").upsert(cleanObject(req.body)).select("*").single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete("/api/manifests/:id", requireSupabase, async (req, res) => {
  try {
    const { error } = await supabase.from("manifests").delete().eq("manifestNo", req.params.id);
    if (error) throw error;
    res.json({ success: true, message: "Manifest deleted" });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 6.1 Manifest File Manager
app.get("/api/manifests/:id/files", requireSupabase, async (req, res) => {
  try {
    const { data, error } = await supabase.from("manifest_files").select("*").eq("manifestNo", req.params.id).order("type", { ascending: false }).order("name", { ascending: true });
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post("/api/manifests/:id/files", requireSupabase, async (req, res) => {
  try {
    const payload = {
      manifestNo: req.params.id,
      name: req.body.name,
      parent_id: req.body.parent_id || null,
      type: req.body.type,
      content: req.body.content || "",
      mime_type: req.body.mime_type || "text/plain",
      size: req.body.size || 0
    };
    const { data, error } = await supabase.from("manifest_files").insert(payload).select("*").single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.patch("/api/manifests/files/:fileId", requireSupabase, async (req, res) => {
  try {
    const payload = cleanObject({
      name: req.body.name,
      parent_id: req.body.parent_id,
      content: req.body.content,
      updated_at: new Date().toISOString()
    });
    const { data, error } = await supabase.from("manifest_files").update(payload).eq("id", req.params.fileId).select("*").single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete("/api/manifests/files/:fileId", requireSupabase, async (req, res) => {
  try {
    const { error } = await supabase.from("manifest_files").delete().eq("id", req.params.fileId);
    if (error) throw error;
    res.json({ success: true, message: "Deleted" });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post("/api/manifests/files/bulk", requireSupabase, async (req, res) => {
  try {
    const { ids, action, target_parent_id } = req.body;
    if (!ids || !Array.isArray(ids)) throw new Error("IDs required");

    if (action === 'delete') {
      const { error } = await supabase.from("manifest_files").delete().in("id", ids);
      if (error) throw error;
    } else if (action === 'move') {
      const { error } = await supabase.from("manifest_files").update({ parent_id: target_parent_id, updated_at: new Date().toISOString() }).in("id", ids);
      if (error) throw error;
    } else if (action === 'copy') {
      // Fetch originals
      const { data: originals, error: fError } = await supabase.from("manifest_files").select("*").in("id", ids);
      if (fError) throw fError;

      const copies = originals.map(o => ({
        manifestNo: o.manifestNo,
        name: `${o.name} (Copy)`,
        parent_id: target_parent_id,
        type: o.type,
        content: o.content,
        storage_path: o.storage_path,
        size: o.size,
        mime_type: o.mime_type
      }));
      const { error: iError } = await supabase.from("manifest_files").insert(copies);
      if (iError) throw iError;
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 7. Dashboard Stats
app.get("/api/stats/dashboard", requireSupabase, async (req, res) => {
  try {
    if (IS_DEMO) {
      return res.json({
        success: true,
        totalSwbs: 1,
        pending: 0, received: 0, processing: 0, inTransit: 1, arrived: 0, delivered: 0, cancelled: 0,
        breakdown: { "In Transit": 1 },
        recentItems: [{ swbSerial: "NOORANI-DEMO-001", status: "In Transit" }]
      });
    }

    const table = await getActiveTable();

    // 1. Get status counts via RPC or direct query if RPC fails
    let breakdown = {};
    const { data: counts, error: cError } = await supabase.rpc('get_status_counts');

    if (!cError && counts) {
      counts.forEach(r => { breakdown[r.status] = parseInt(r.count); });
    } else {
      // Fallback if RPC not initialized
      const { data, error } = await supabase.from(table).select("status");
      if (!error) (data || []).forEach(r => { const s = r.status || "Created"; breakdown[s] = (breakdown[s] || 0) + 1; });
    }

    // 2. Get recent activity
    const { data: recent, error: rError } = await supabase.from(table)
      .select("swbSerial, customer, status, swbDate, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    const count = s => breakdown[s] || 0;
    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

    res.json({
      success: true,
      totalSwbs: total,
      pending: count("Pending") + count("Created") + count("Received"),
      received: count("Received"),
      processing: count("Processing"),
      inTransit: count("In Transit") + count("Allocated") + count("Picked Up"),
      arrived: count("Arrived"),
      delivered: count("Delivered"),
      cancelled: count("Cancelled"),
      breakdown,
      recentItems: (recent || []).map(item => mapFromTableSchema(item, table === 'swbs')),
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 8. Users
app.get("/api/users", requireSupabase, async (req, res) => {
  try {
    const { data, error } = await supabase.from("users").select("id, email, role, status, created_at");
    if (error) throw error;
    res.json((data || []).map(u => ({ ...u, uid: String(u.id) })));
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get("/api/users/profile/:email", requireSupabase, async (req, res) => {
  try {
    const { data, error } = await supabase.from("users").select("*").eq("email", req.params.email).maybeSingle();
    if (error || !data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// =====================================================
// ROOT & 404
// =====================================================

app.get("/", (req, res) => res.json({ success: true, name: "Noorani Cargo Enterprise API", version: "2.9.0" }));

app.use("/api", (req, res) => {
    console.error(`[API 404] ${req.method} ${req.originalUrl} - No matching route found.`);
    res.status(404).json({
        success: false,
        error: "API endpoint not found",
        method: req.method,
        url: req.originalUrl,
        message: `No route matches ${req.method} ${req.originalUrl}`,
        suggestion: "Verify API_BASE_URL in frontend matches backend routes exactly."
    });
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: "Global 404",
        message: "This is a non-API 404. You may be missing the /api prefix."
    });
});

// Global Error
app.use((err, req, res, next) => {
  console.error("[SERVER ERROR]", err);
  res.status(500).json({ success: false, error: err.message || "Internal server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Noorani API] Running on port ${PORT}`);
});
