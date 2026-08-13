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
  "http://localhost:5173",
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
// SUPABASE
// =====================================================

let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  console.log("[System] Supabase connected.");
} else {
  console.error(
    "[System] CRITICAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are missing."
  );
}

// =====================================================
// HELPERS
// =====================================================

function requireSupabase(req, res, next) {
  if (!supabase) {
    return res.status(503).json({
      success: false,
      error: "Database configuration is missing.",
      message:
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in Render.",
    });
  }

  next();
}

function cleanObject(obj) {
  const result = {};

  for (const [key, value] of Object.entries(obj || {})) {
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

// =====================================================
// ROOT / HEALTH
// =====================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Noorani Cargo Enterprise API",
    version: "2.3.5",
    status: "online",
    database: supabase ? "configured" : "not_configured",
    time: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    databaseConfigured: !!supabase,
    version: "2.3.5",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    databaseConfigured: !!supabase,
    version: "2.3.5",
  });
});

// =====================================================
// SWB - GET ALL
// =====================================================

app.get("/api/swbs", requireSupabase, async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();

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

    const { data, error } = await query;

    if (error) {
      console.error("[GET /api/swbs]", error);

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    res.json({
      success: true,
      count: data?.length || 0,
      data: data || [],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// =====================================================
// SWB - GET ONE
// =====================================================

app.get("/api/swbs/:serial", requireSupabase, async (req, res) => {
  try {
    const serial = decodeURIComponent(req.params.serial);

    const { data, error } = await supabase
      .from("swbs")
      .select("*")
      .eq("swbSerial", serial)
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "SWB not found",
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// =====================================================
// SWB - CREATE
// =====================================================

app.post("/api/swbs", requireSupabase, async (req, res) => {
  try {
    const body = req.body || {};

    if (!body.swbSerial) {
      return res.status(400).json({
        success: false,
        error: "SWB Serial Number is required.",
      });
    }

    const record = cleanObject({
      swbSerial: body.swbSerial,
      custInvNo: body.custInvNo,
      swbDate: body.swbDate,
      customer: body.customer,
      customerInvNo: body.customerInvNo,
      shipperName: body.shipperName,
      consigneeName: body.consigneeName,
      origQty: body.origQty,
      origWt: body.origWt,
      consigneeCity: body.consigneeCity,
      consigneeAddress: body.consigneeAddress,

      status: body.status || "Received",
      origin: body.origin,
      destination: body.destination,
      manifestNo: body.manifestNo,
      assignedTo: body.assignedTo,
      expectedDelivery: body.expectedDelivery,
      notes: body.notes,
      type: body.type || "SWB",
    });

    const { data, error } = await supabase
      .from("swbs")
      .insert(record)
      .select("*")
      .single();

    if (error) {
      console.error("[CREATE SWB]", error);

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    // Timeline
    await supabase.from("status_history").insert({
      swbSerial: data.swbSerial,
      status: data.status || "Received",
      location: data.origin || null,
      remarks: "Shipment created",
      actorEmail: req.body.actorEmail || "system",
    });

    res.status(201).json({
      success: true,
      message: "SWB created successfully.",
      data,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// =====================================================
// SWB - UPDATE
// =====================================================

app.put("/api/swbs/:serial", requireSupabase, async (req, res) => {
  try {
    const serial = decodeURIComponent(req.params.serial);
    const body = req.body || {};

    const allowedFields = [
      "custInvNo",
      "swbDate",
      "customer",
      "customerInvNo",
      "shipperName",
      "consigneeName",
      "origQty",
      "origWt",
      "consigneeCity",
      "consigneeAddress",
      "status",
      "origin",
      "destination",
      "manifestNo",
      "assignedTo",
      "expectedDelivery",
      "notes",
      "type",
    ];

    const update = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        update[field] = body[field];
      }
    }

    const { data: oldRecord } = await supabase
      .from("swbs")
      .select("*")
      .eq("swbSerial", serial)
      .maybeSingle();

    if (!oldRecord) {
      return res.status(404).json({
        success: false,
        error: "SWB not found",
      });
    }

    const { data, error } = await supabase
      .from("swbs")
      .update(update)
      .eq("swbSerial", serial)
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    // Save status change
    if (
      body.status !== undefined &&
      body.status !== oldRecord.status
    ) {
      await supabase.from("status_history").insert({
        swbSerial: serial,
        status: body.status,
        location: body.location || body.destination || null,
        remarks: body.remarks || "Status updated",
        actorEmail: body.actorEmail || "system",
      });
    }

    res.json({
      success: true,
      message: "SWB updated successfully.",
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// =====================================================
// SWB - DELETE
// =====================================================

app.delete("/api/swbs/:serial", requireSupabase, async (req, res) => {
  try {
    const serial = decodeURIComponent(req.params.serial);

    await supabase
      .from("status_history")
      .delete()
      .eq("swbSerial", serial);

    const { error } = await supabase
      .from("swbs")
      .delete()
      .eq("swbSerial", serial);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    res.json({
      success: true,
      message: "SWB deleted successfully.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// =====================================================
// TRACKING
// =====================================================

app.get(
  "/api/tracking/:serial",
  requireSupabase,
  async (req, res) => {
    try {
      const serial = decodeURIComponent(req.params.serial);

      const { data: shipment, error } = await supabase
        .from("swbs")
        .select("*")
        .eq("swbSerial", serial)
        .maybeSingle();

      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }

      if (!shipment) {
        return res.status(404).json({
          success: false,
          error: "Shipment not found.",
        });
      }

      const { data: history } = await supabase
        .from("status_history")
        .select("*")
        .eq("swbSerial", serial)
        .order("id", { ascending: true });

      res.json({
        success: true,
        shipment,
        history: history || [],
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// =====================================================
// STATUS HISTORY
// =====================================================

app.get(
  "/api/swbs/:serial/history",
  requireSupabase,
  async (req, res) => {
    try {
      const serial = decodeURIComponent(req.params.serial);

      const { data, error } = await supabase
        .from("status_history")
        .select("*")
        .eq("swbSerial", serial)
        .order("id", { ascending: true });

      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }

      res.json({
        success: true,
        data: data || [],
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// =====================================================
// MANIFESTS - GET
// =====================================================

app.get("/api/manifests", requireSupabase, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("manifests")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// =====================================================
// MANIFESTS - CREATE
// =====================================================

app.post("/api/manifests", requireSupabase, async (req, res) => {
  try {
    const body = req.body || {};

    if (!body.manifestNo) {
      return res.status(400).json({
        success: false,
        error: "Manifest number is required.",
      });
    }

    const manifest = {
      manifestNo: body.manifestNo,
      date: body.date || new Date().toISOString(),
      origin: body.origin || null,
      destination: body.destination || null,
      containerNo: body.containerNo || null,
      status: body.status || "Open",
    };

    const { data, error } = await supabase
      .from("manifests")
      .insert(manifest)
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// =====================================================
// DASHBOARD STATS
// =====================================================

app.get("/api/stats/dashboard", requireSupabase, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("swbs")
      .select("status");

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    const rows = data || [];

    const count = (status) =>
      rows.filter((x) => x.status === status).length;

    res.json({
      success: true,
      totalSwbs: rows.length,
      pending: count("Pending"),
      received: count("Received"),
      processing: count("Processing"),
      inTransit: count("In Transit"),
      arrived: count("Arrived"),
      delivered: count("Delivered"),
      cancelled: count("Cancelled"),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
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
  console.log(" Version: 2.3.5");
  console.log(` Port: ${PORT}`);
  console.log(` Supabase: ${supabase ? "CONNECTED" : "NOT CONFIGURED"}`);
  console.log("==========================================");
});