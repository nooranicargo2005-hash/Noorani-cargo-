const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// =====================================================
// ENVIRONMENT
// =====================================================

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.SUPABASE_PROJECT_URL;

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const ADMIN_ORIGINS = [
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
];

const allowedOrigins = [
  ...ADMIN_ORIGINS,
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((x) => x.trim())
    : []),
];

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow server-to-server / curl / Postman
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS blocked"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// =====================================================
// SUPABASE (STRICT PRODUCTION CONFIG)
// =====================================================

let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY && !SUPABASE_KEY.includes("your-")) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  console.log("[System] Supabase initialized.");
} else {
  console.error(
    "[System] CRITICAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are missing or invalid."
  );
}

function requireSupabase(req, res, next) {
  if (!supabase) {
    return res.status(503).json({
      success: false,
      error: "Database configuration is missing.",
      message: "The server is not connected to Supabase. Check Render environment variables.",
    });
  }
  next();
}

function cleanObject(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj || {})) {
    if (value !== undefined && value !== null) {
      result[key] = value;
    }
  }
  return result;
}

// =====================================================
// ROOT / HEALTH (PRODUCTION DIAGNOSTICS)
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Noorani Cargo Enterprise API",
    version: "2.3.7",
    status: "online",
    database: supabase ? "connected" : "disconnected",
    time: new Date().toISOString(),
  });
});

app.get("/api/health", async (req, res) => {
  let dbStatus = "not_configured";
  let canQuery = false;
  let dbError = null;

  if (supabase) {
    dbStatus = "configured";
    try {
      // Real connection test: query the count of shipments
      const { count, error } = await supabase.from("swbs").select("*", { count: "exact", head: true });

      if (error) {
        dbError = {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          status: error.status
        };
        console.error("[Health] Database query failed:", dbError);
      } else {
        canQuery = true;
      }
    } catch (e) {
      dbError = { message: e.message };
      console.error("[Health] Unexpected error during connectivity test:", e.message);
    }
  }

  res.json({
    success: true,
    status: "healthy",
    databaseConfigured: !!supabase,
    databaseReachable: canQuery,
    databaseError: dbError,
    missing: [
      !SUPABASE_URL && "SUPABASE_URL",
      !SUPABASE_KEY && "SUPABASE_SERVICE_ROLE_KEY"
    ].filter(Boolean),
    version: "2.3.7",
  });
});

// =====================================================
// SWB - GET ALL
// =====================================================

app.get("/api/swbs", requireSupabase, async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const status = req.query.status;
    const origin = req.query.origin;
    const destination = req.query.destination;
    const manifestNo = req.query.manifestNo;

    let query = supabase
      .from("swbs")
      .select("*")
      .order("created_at", { ascending: false });

    if (search) {
      const safe = search.replace(/,/g, " ");
      query = query.or(
        `swbSerial.ilike.%${safe}%,customer.ilike.%${safe}%,shipperName.ilike.%${safe}%,consigneeName.ilike.%${safe}%,consigneeCity.ilike.%${safe}%`
      );
    }

    if (status) query = query.eq("status", status);
    if (origin) query = query.ilike("origin", `%${origin}%`);
    if (destination) query = query.ilike("consigneeCity", `%${destination}%`);
    if (manifestNo) query = query.eq("manifestNo", manifestNo);

    const { data, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      count: data?.length || 0,
      data: data || [],
      items: data || [],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// SWB - GET ONE (SUPPORTING BOTH :SERIAL AND :ID)
// =====================================================

app.get("/api/swbs/:serial", requireSupabase, async (req, res) => {
  try {
    const serial = decodeURIComponent(req.params.serial);
    const { data, error } = await supabase.from("swbs").select("*").eq("swbSerial", serial).maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: "SWB not found" });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Alias for legacy test support
app.get("/swbs/:serial", (req, res) => res.redirect(`/api/swbs/${req.params.serial}`));

// =====================================================
// SWB - CREATE OR UPDATE (UPSERT)
// =====================================================

app.post("/api/swbs/:serial", requireSupabase, async (req, res) => {
  try {
    const serial = decodeURIComponent(req.params.serial);
    const body = req.body || {};

    const record = cleanObject({
      swbSerial: serial,
      custInvNo: body.custInvNo,
      swbDate: body.swbDate,
      customer: body.customer,
      customerInvNo: body.customerInvNo,
      shipperName: body.shipperName,
      consigneeName: body.consigneeName,
      origQty: parseInt(body.origQty) || 0,
      origWt: parseFloat(body.origWt) || 0.0,
      consigneeCity: body.consigneeCity,
      consigneeAddress: body.consigneeAddress,
      status: body.status || "Created",
      origin: body.origin,
      destination: body.destination,
      manifestNo: body.manifestNo,
      assignedTo: body.assignedTo,
      expectedDelivery: body.expectedDelivery,
      notes: body.notes,
      type: body.type || "SWB",
      updated_at: new Date().toISOString()
    });

    // Check if exists for timeline tracking
    const { data: existing } = await supabase.from("swbs").select("status").eq("swbSerial", serial).maybeSingle();

    const { data, error } = await supabase.from("swbs").upsert(record).select("*").single();
    if (error) throw error;

    // Timeline if status changed or new
    if (!existing || existing.status !== record.status) {
      await supabase.from("status_history").insert({
        swbSerial: serial,
        status: record.status,
        remarks: existing ? "Status updated" : "Shipment created",
        actorEmail: body.actorEmail || "system",
      });
    }

    res.json({ success: true, message: "SWB record synchronized.", data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// SWB - BULK STATUS UPDATE
// =====================================================

app.post("/api/swbs/bulk/status", requireSupabase, async (req, res) => {
  try {
    const { ids, status, remarks, actorEmail } = req.body || {};
    if (!ids || !Array.isArray(ids) || !status) return res.status(400).json({ success: false, error: "Invalid bulk data" });

    const { error } = await supabase.from("swbs").update({ status }).in("swbSerial", ids);
    if (error) throw error;

    const history = ids.map((id) => ({
      swbSerial: id,
      status,
      remarks: remarks || "Bulk status update",
      actorEmail: actorEmail || "system",
    }));
    await supabase.from("status_history").insert(history);

    res.json({ success: true, message: `Updated ${ids.length} records.` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// SWB - DELETE
// =====================================================

app.delete("/api/swbs/:serial", requireSupabase, async (req, res) => {
  try {
    const serial = decodeURIComponent(req.params.serial);

    // Cleanup history first
    await supabase.from("status_history").delete().eq("swbSerial", serial);

    const { error } = await supabase.from("swbs").delete().eq("swbSerial", serial);
    if (error) throw error;

    res.json({ success: true, message: "SWB deleted successfully." });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// TRACKING (PUBLIC)
// =====================================================

app.get("/api/tracking/:serial", requireSupabase, async (req, res) => {
  try {
    const serial = decodeURIComponent(req.params.serial);
    const { data: shipment, error } = await supabase.from("swbs").select("*").eq("swbSerial", serial).maybeSingle();

    if (error) throw error;
    if (!shipment) return res.status(404).json({ success: false, error: "Shipment not found." });

    const { data: history } = await supabase.from("status_history").select("*").eq("swbSerial", serial).order("created_at", { ascending: true });

    res.json({ success: true, shipment, history: history || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// STATUS HISTORY
// =====================================================

app.get("/api/swbs/:serial/history", requireSupabase, async (req, res) => {
  try {
    const serial = decodeURIComponent(req.params.serial);
    const { data, error } = await supabase.from("status_history").select("*").eq("swbSerial", serial).order("created_at", { ascending: true });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// MANIFESTS
// =====================================================

app.get("/api/manifests", requireSupabase, async (req, res) => {
  try {
    const { data, error } = await supabase.from("manifests").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/manifests", requireSupabase, async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.manifestNo) return res.status(400).json({ success: false, error: "Manifest number is required." });

    const manifest = {
      manifestNo: body.manifestNo,
      date: body.date || new Date().toISOString(),
      origin: body.origin || null,
      destination: body.destination || null,
      containerNo: body.containerNo || null,
      status: body.status || "Open",
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from("manifests").upsert(manifest).select("*").single();
    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// DASHBOARD STATS
// =====================================================

app.get("/api/stats/dashboard", requireSupabase, async (req, res) => {
  try {
    const { data, error } = await supabase.from("swbs").select("status, swbSerial, customer, swbDate").order("created_at", { ascending: false });
    if (error) throw error;

    const rows = data || [];
    const breakdown = {};
    rows.forEach((r) => {
      const s = r.status || "Created";
      breakdown[s] = (breakdown[s] || 0) + 1;
    });

    const count = (status) => breakdown[status] || 0;

    res.json({
      success: true,
      totalSwbs: rows.length,
      pending: count("Pending") + count("Created") + count("Received"),
      received: count("Received"),
      processing: count("Processing"),
      inTransit: count("In Transit") + count("Allocated"),
      arrived: count("Arrived"),
      delivered: count("Delivered"),
      cancelled: count("Cancelled"),
      breakdown,
      recentItems: rows.slice(0, 10),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// USERS MANAGEMENT
// =====================================================

app.get("/api/users", requireSupabase, async (req, res) => {
  try {
    const { data, error } = await supabase.from("users").select("id, email, role, status, created_at");
    if (error) throw error;
    res.json(data.map(u => ({ ...u, uid: String(u.id) })));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/users", requireSupabase, async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const { data, error } = await supabase.from("users").insert({ email, password, role }).select("*").single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/users/:uid", requireSupabase, async (req, res) => {
  try {
    const { error } = await supabase.from("users").delete().eq("id", req.params.uid);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/users/profile/:email", requireSupabase, async (req, res) => {
  try {
    const { data, error } = await supabase.from("users").select("*").eq("email", req.params.email).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "User not found" });
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// 404 API HANDLER
// =====================================================

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found",
    path: req.originalUrl,
  });
});

// =====================================================
// GLOBAL ERROR
// =====================================================

app.use((err, req, res, next) => {
  console.error("[SERVER ERROR]", err);
  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

// =====================================================
// START
// =====================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log("==========================================");
  console.log(" NOORANI CARGO ENTERPRISE API");
  console.log(" Version: 2.3.7");
  console.log(` Port: ${PORT}`);
  console.log(` Supabase URL: ${SUPABASE_URL ? "PRESENT" : "MISSING"}`);
  console.log(` Supabase Key: ${SUPABASE_KEY ? "PRESENT" : "MISSING"}`);
  console.log(` Supabase Client: ${supabase ? "INITIALIZED" : "FAILED"}`);
  console.log("==========================================");
});
