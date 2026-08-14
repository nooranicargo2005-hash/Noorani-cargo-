/**
 * NOORANI CARGO ENTERPRISE API
 * Version: 2.9.0
 * Updated: 2026-08-14 (Flattened Routes & Robust Connectivity)
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

async function getActiveTable() {
  if (IS_DEMO || !supabase) return "shipments";
  try {
    const { error } = await supabase.from("shipments").select("id").limit(1);
    if (error && (error.message.includes("does not exist") || error.code === '42P01')) return "swbs";
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
// FLATTENED API ROUTES (No Router Middleware for Max Compatibility)
// =====================================================

// 1. Health & Debug
app.get("/api/health", requireSupabase, async (req, res) => {
  try {
    const table = await getActiveTable();
    res.json({ success: true, status: "healthy", table, databaseReachable: !!supabase });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get("/api/debug", (req, res) => {
    res.json({
        success: true,
        env: {
            HAS_URL: !!SUPABASE_URL,
            HAS_KEY: !!SUPABASE_KEY,
            PORT: PORT,
            NODE_ENV: process.env.NODE_ENV
        },
        headers: req.headers,
        url: req.url,
        baseUrl: req.baseUrl,
        path: req.path
    });
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
    let q = supabase.from(table).select("*").order("created_at", { ascending: false });

    if (search) {
      const s = search.replace(/,/g, " ");
      q = q.or(`swbSerial.ilike.%${s}%,customer.ilike.%${s}%,shipperName.ilike.%${s}%,consigneeName.ilike.%${s}%,consigneeCity.ilike.%${s}%`);
    }
    if (status && status !== "") q = q.eq("status", status);
    if (origin && origin !== "") q = q.ilike("origin", `%${origin}%`);
    if (destination && destination !== "") q = q.ilike("consigneeCity", `%${destination}%`);
    if (manifestNo && manifestNo !== "") q = q.eq("manifestNo", manifestNo);

    if (limit) {
      const l = parseInt(limit);
      if (!isNaN(l) && l > 0) q = q.limit(l);
    }

    const { data, error } = await q;
    if (error) throw error;
    res.json({ success: true, count: data?.length || 0, items: data || [] });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
};

app.get("/api/shipments", requireSupabase, getAllShipments);
app.get("/api/shipments/", requireSupabase, getAllShipments); // Trailing slash fallback
app.get("/api/swbs", requireSupabase, getAllShipments);

// 3. Shipment Details & CRUD
app.get("/api/shipments/:serial", requireSupabase, async (req, res) => {
  try {
    const table = await getActiveTable();
    const { data, error } = await supabase.from(table).select("*").eq("swbSerial", req.params.serial).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: "Shipment not found" });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post("/api/shipments/:serial", requireSupabase, async (req, res) => {
  try {
    const serial = req.params.serial;
    const table = await getActiveTable();
    const record = cleanObject({
      swbSerial: serial,
      custInvNo: req.body.custInvNo,
      swbDate: req.body.swbDate,
      customer: req.body.customer,
      shipperName: req.body.shipperName,
      shipperPhone: req.body.shipperPhone,
      shipperAddress: req.body.shipperAddress,
      consigneeName: req.body.consigneeName,
      consigneePhone: req.body.consigneePhone,
      consigneeCity: req.body.consigneeCity,
      consigneeAddress: req.body.consigneeAddress,
      origin: req.body.origin,
      destination: req.body.destination,
      status: req.body.status || "Created",
      manifestNo: req.body.manifestNo,
      notes: req.body.notes,
      origQty: req.body.origQty,
      origWt: req.body.origWt,
      type: req.body.type || "SWB",
      updated_at: new Date().toISOString()
    });

    const { data: existing } = await supabase.from(table).select("status").eq("swbSerial", serial).maybeSingle();
    const { data, error } = await supabase.from(table).upsert(record).select("*").single();
    if (error) throw error;

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
    const records = items.filter(i => i.swbSerial).map(item => cleanObject({
      swbSerial: String(item.swbSerial).trim(),
      custInvNo: item.custInvNo,
      swbDate: item.swbDate,
      customer: item.customer,
      shipperName: item.shipperName,
      shipperPhone: item.shipperPhone,
      shipperAddress: item.shipperAddress,
      consigneeName: item.consigneeName,
      consigneePhone: item.consigneePhone,
      consigneeCity: item.consigneeCity,
      consigneeAddress: item.consigneeAddress,
      origin: item.origin,
      destination: item.destination,
      status: item.status || "Created",
      manifestNo: item.manifestNo,
      notes: item.notes,
      origQty: parseInt(item.origQty) || 0,
      origWt: parseFloat(item.origWt) || 0,
      type: item.type || "SWB",
      updated_at: new Date().toISOString()
    }));

    if (records.length === 0) return res.json({ success: true, count: 0 });

    if (IS_DEMO) {
      return res.json({ success: true, count: records.length, message: "Demo mode: Records simulated." });
    }

    const { data, error } = await supabase.from(table).upsert(records, { onConflict: 'swbSerial' }).select("swbSerial");
    if (error) throw error;
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
    const { data: shipment, error } = await supabase.from(table).select("*").eq("swbSerial", req.params.serial).maybeSingle();
    if (error || !shipment) return res.status(404).json({ success: false, error: "Not identified" });
    const { data: history } = await supabase.from("status_history").select("*").eq("swbSerial", req.params.serial).order("created_at", { ascending: true });
    res.json({ success: true, shipment, history: history || [] });
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
    const { data, error } = await supabase.from("manifests").select("*").order("created_at", { ascending: false });
    res.json({ success: true, data: data || [] });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post("/api/manifests", requireSupabase, async (req, res) => {
  try {
    const { data, error } = await supabase.from("manifests").upsert(cleanObject(req.body)).select("*").single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 7. Dashboard Stats
app.get("/api/stats/dashboard", requireSupabase, async (req, res) => {
  try {
    if (IS_DEMO) {
      return res.json({
        success: true,
        totalSwbs: 1,
        pending: 0,
        received: 0,
        processing: 0,
        inTransit: 1,
        arrived: 0,
        delivered: 0,
        cancelled: 0,
        breakdown: { "In Transit": 1 },
        recentItems: [{ swbSerial: "NOORANI-DEMO-001", status: "In Transit" }]
      });
    }
    const table = await getActiveTable();
    const { data, error } = await supabase.from(table).select("status, swbSerial, customer, swbDate").order("created_at", { ascending: false });
    if (error) throw error;
    const b = {};
    (data || []).forEach(r => { const s = r.status || "Created"; b[s] = (b[s] || 0) + 1; });
    const count = s => b[s] || 0;
    res.json({
      success: true,
      totalSwbs: data?.length || 0,
      pending: count("Pending") + count("Created") + count("Received"),
      received: count("Received"),
      processing: count("Processing"),
      inTransit: count("In Transit") + count("Allocated") + count("Picked Up"),
      arrived: count("Arrived"),
      delivered: count("Delivered"),
      cancelled: count("Cancelled"),
      breakdown: b,
      recentItems: (data || []).slice(0, 10),
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
