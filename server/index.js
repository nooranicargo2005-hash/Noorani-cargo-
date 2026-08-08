const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;

// Production Domain List for CORS
const allowedOrigins = [
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5501',
    'http://localhost:5500',
    'http://localhost:5501',
    'https://noorani-cargo-admin-2005.web.app',
    'https://noorani-cargo-tracking-2005.web.app',
    'https://noorani-cargo-admin.web.app',
    'https://noorani-cargo-tracking.web.app'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            console.warn('[CORS] Origin Check:', origin);
            return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true
}));

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// --- Database & Storage Initialization ---
const dataDir = process.env.DATA_DIR || (fs.existsSync(path.join(__dirname, '..', 'data'))
    ? path.join(__dirname, '..', 'data')
    : path.join(__dirname, 'data'));

const uploadsDir = path.join(dataDir, 'uploads');
const dbPath = path.join(dataDir, 'noorani-cargo.db');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
[uploadsDir, path.join(uploadsDir, 'documents'), path.join(uploadsDir, 'images'), path.join(uploadsDir, 'pdf'), path.join(uploadsDir, 'excel')].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use('/uploads', express.static(uploadsDir));

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('[DB] Connection Error:', err.message);
    else {
        console.log('[DB] SQLite Ready:', dbPath);
        initDbSchema();
    }
});

function initDbSchema() {
    db.serialize(() => {
        console.log('[DB] Initializing schema...');
        db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, displayName TEXT, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'employee', branchCode TEXT, status TEXT DEFAULT 'enabled', permissions TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, fullName TEXT NOT NULL, companyName TEXT, mobileNumber TEXT, whatsAppNumber TEXT, email TEXT, nationalId TEXT, address TEXT, city TEXT, country TEXT, postalCode TEXT, customerType TEXT DEFAULT 'Individual', notes TEXT, status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY, fullName TEXT NOT NULL, fatherName TEXT, dob TEXT, gender TEXT, email TEXT, mobileNumber TEXT, whatsAppNumber TEXT, nationalId TEXT, address TEXT, designation TEXT, department TEXT, assignedBranch TEXT, employmentType TEXT DEFAULT 'Full-Time', employmentStatus TEXT DEFAULT 'Active', dateOfJoining TEXT, basicSalary REAL, emergencyContactName TEXT, emergencyContactPhone TEXT, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS drivers (id TEXT PRIMARY KEY, fullName TEXT NOT NULL, email TEXT, mobileNumber TEXT, whatsAppNumber TEXT, nationalId TEXT, licenseNumber TEXT, licenseExpiry TEXT, branchCode TEXT, assignedVehicle TEXT, address TEXT, emergencyContact TEXT, notes TEXT, status TEXT DEFAULT 'active', dateOfJoining TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS vehicles (id TEXT PRIMARY KEY, plateNumber TEXT UNIQUE NOT NULL, brand TEXT, model TEXT, year TEXT, vehicleType TEXT, registrationNumber TEXT, registrationExpiry TEXT, insuranceExpiry TEXT, chassisNumber TEXT, engineNumber TEXT, capacity TEXT, fuelType TEXT, assignedDriver TEXT, assignedBranch TEXT, currentMileage REAL DEFAULT 0, status TEXT DEFAULT 'Available', notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS branches (id TEXT PRIMARY KEY, branchName TEXT NOT NULL, branchCode TEXT UNIQUE NOT NULL, managerName TEXT, phoneNumber TEXT, whatsAppNumber TEXT, email TEXT, address TEXT, city TEXT, state TEXT, country TEXT, postalCode TEXT, googleMaps TEXT, timeZone TEXT, workingHours TEXT, status TEXT DEFAULT 'active', notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS shipments (trackingId TEXT PRIMARY KEY, ref TEXT, shippingNumber TEXT, date TEXT, sender TEXT, senderPhone TEXT, senderAddress TEXT, originCountry TEXT, origin TEXT, receiver TEXT, receiverPhone TEXT, receiverAddress TEXT, destination TEXT, destinationCountry TEXT, shipmentType TEXT, weight REAL, quantity INTEGER, shippingCost REAL, paymentStatus TEXT DEFAULT 'Unpaid', status TEXT DEFAULT 'Pending', author TEXT, driver TEXT, vehicle TEXT, branchCode TEXT, notes TEXT, public INTEGER DEFAULT 1, source TEXT DEFAULT 'manual', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, invoiceNumber TEXT UNIQUE NOT NULL, trackingId TEXT, amount REAL, currency TEXT DEFAULT 'SAR', status TEXT DEFAULT 'issued', updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (trackingId) REFERENCES shipments (trackingId))`);
        db.run(`CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, type TEXT CHECK(type IN ('income', 'expense')), category TEXT, description TEXT, amount REAL, date TEXT, paymentMethod TEXT, status TEXT DEFAULT 'Paid', shipmentRef TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS shipment_timeline (id INTEGER PRIMARY KEY AUTOINCREMENT, trackingNumber TEXT NOT NULL, eventType TEXT, title TEXT, description TEXT, actor TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (trackingNumber) REFERENCES shipments (trackingId))`);
        db.run(`CREATE TABLE IF NOT EXISTS shipment_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, trackingNumber TEXT NOT NULL, content TEXT, author TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (trackingNumber) REFERENCES shipments (trackingId))`);
        db.run(`CREATE TABLE IF NOT EXISTS settings (category TEXT NOT NULL, setting_key TEXT NOT NULL, setting_value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (category, setting_key))`);
        db.run(`CREATE TABLE IF NOT EXISTS uploaded_files (id INTEGER PRIMARY KEY AUTOINCREMENT, trackingId TEXT, fileName TEXT NOT NULL, filePath TEXT NOT NULL, fileType TEXT, fileSize INTEGER, assetType TEXT, upload_date DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (trackingId) REFERENCES shipments (trackingId))`);
        db.run(`CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, details TEXT, module TEXT, actorEmail TEXT, actorName TEXT, actorRole TEXT, deviceInfo TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, message TEXT, type TEXT, link TEXT, recipientUid TEXT, read INTEGER DEFAULT 0, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments (status)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_timeline_tracking ON shipment_timeline (trackingNumber)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_notes_tracking ON shipment_notes (trackingNumber)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_files_tracking ON uploaded_files (trackingId)`);
        console.log('[DB] Schema verified.');
    });
}

// Helper for sequential async queries
const dbQuery = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { if (err) reject(err); else resolve({ id: this.lastID, changes: this.changes }); });
});

// --- API Routes ---

app.get('/', (req, res) => res.send('Noorani Cargo Enterprise API is online.'));
app.get('/api/health', (req, res) => res.json({
    status: 'ok',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    dbConnected: !!db
}));

// Dashboard Stats
app.get('/api/stats/dashboard', async (req, res) => {
    try {
        const stats = {
            totalShipments: (await dbGet("SELECT COUNT(*) as c FROM shipments")).c,
            delivered: (await dbGet("SELECT COUNT(*) as c FROM shipments WHERE status LIKE '%Delivered%'")).c,
            inTransit: (await dbGet("SELECT COUNT(*) as c FROM shipments WHERE status LIKE '%Transit%' OR status LIKE '%Arrived%'")).c,
            pending: (await dbGet("SELECT COUNT(*) as c FROM shipments WHERE status = 'Pending'")).c,
            cancelled: (await dbGet("SELECT COUNT(*) as c FROM shipments WHERE status = 'Cancelled'")).c,
            totalCustomers: (await dbGet("SELECT COUNT(*) as c FROM customers")).c,
            totalDrivers: (await dbGet("SELECT COUNT(*) as c FROM drivers")).c,
            totalVehicles: (await dbGet("SELECT COUNT(*) as c FROM vehicles")).c,
            totalEmployees: (await dbGet("SELECT COUNT(*) as c FROM employees")).c,
            totalBranches: (await dbGet("SELECT COUNT(*) as c FROM branches")).c,
            totalRevenue: (await dbGet("SELECT SUM(shippingCost) as s FROM shipments WHERE paymentStatus = 'Paid'")).s || 0,
            totalExpenses: (await dbGet("SELECT SUM(amount) as s FROM transactions WHERE type = 'expense'")).s || 0
        };
        stats.profit = stats.totalRevenue - stats.totalExpenses;
        res.json(stats);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Shipments
app.get('/api/shipments', async (req, res) => {
    try {
        const { search, sortBy = 'updated_at', sortDir = 'DESC', limit = 1000 } = req.query;
        let sql = "SELECT * FROM shipments";
        let params = [];
        if (search) {
            sql += " WHERE trackingId LIKE ? OR sender LIKE ? OR receiver LIKE ? OR senderPhone LIKE ? OR receiverPhone LIKE ?";
            const p = `%${search}%`;
            params = [p, p, p, p, p];
        }
        sql += ` ORDER BY ${sortBy} ${sortDir} LIMIT ?`;
        params.push(parseInt(limit));
        const rows = await dbQuery(sql, params);
        res.json({ items: rows.map(r => ({ trackingId: r.trackingId, data: r })) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/shipments/:id', async (req, res) => {
    try {
        const row = await dbGet("SELECT * FROM shipments WHERE trackingId = ?", [req.params.id]);
        if (!row) return res.status(404).json({ error: "Not found" });
        res.json({ trackingId: row.trackingId, data: row });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shipments/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const d = req.body;
        const sql = `INSERT OR REPLACE INTO shipments (
            trackingId, ref, shippingNumber, date, sender, senderPhone, senderAddress, originCountry, origin,
            receiver, receiverPhone, receiverAddress, destination, destinationCountry, shipmentType,
            weight, quantity, shippingCost, paymentStatus, status, author, driver, vehicle, branchCode,
            notes, public, source, updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP,
            COALESCE((SELECT created_at FROM shipments WHERE trackingId = ?), CURRENT_TIMESTAMP))`;

        const params = [
            id, d.ref || id, d.shippingNumber || '',
            d.date || new Date().toISOString().split('T')[0],
            d.sender || '', d.senderPhone || '', d.senderAddress || '', d.originCountry || '', d.origin || '',
            d.receiver || '', d.receiverPhone || '', d.receiverAddress || '', d.destination || '', d.destinationCountry || '',
            d.shipmentType || 'Air Freight', parseFloat(d.weight) || 0, parseInt(d.quantity) || 1,
            parseFloat(d.shippingCost) || 0, d.paymentStatus || 'Unpaid', d.status || 'Pending',
            d.author || 'System', d.driver || '', d.vehicle || '', d.branchCode || '', d.notes || '',
            d.public === false ? 0 : 1, d.source || 'manual', id
        ];
        await dbRun(sql, params);
        res.json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/shipments/:id', async (req, res) => {
    try {
        await dbRun("DELETE FROM shipments WHERE trackingId = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Entity CRUD
const crud = (entity, table) => {
    app.get(`/api/${entity}`, async (req, res) => {
        try { res.json({ items: await dbQuery(`SELECT * FROM ${table} ORDER BY updated_at DESC`) }); } catch (err) { res.status(500).json({ error: err.message }); }
    });
    app.get(`/api/${entity}/:id`, async (req, res) => {
        try { const r = await dbGet(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]); if(!r) return res.status(404).json({error:"Not found"}); res.json({ [entity.slice(0,-1)]: r }); } catch (err) { res.status(500).json({ error: err.message }); }
    });
    app.delete(`/api/${entity}/:id`, async (req, res) => {
        try { await dbRun(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
    });
};
crud('customers', 'customers'); crud('drivers', 'drivers'); crud('vehicles', 'vehicles'); crud('branches', 'branches'); crud('employees', 'employees');

app.post('/api/customers', async (req, res) => {
    try {
        const d = req.body; const id = d.id || `CUST-${Date.now()}`;
        await dbRun(`INSERT OR REPLACE INTO customers (id, fullName, mobileNumber, customerType, updated_at, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, COALESCE((SELECT created_at FROM customers WHERE id = ?), CURRENT_TIMESTAMP))`, [id, d.fullName, d.mobileNumber, d.customerType, id]);
        res.json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Users
app.get('/api/users', async (req, res) => { try { res.json((await dbQuery("SELECT id, email, role, branchCode, status FROM users")).map(r => ({ ...r, uid: String(r.id) }))); } catch (err) { res.status(500).json({ error: err.message }); } });

app.listen(port, '0.0.0.0', () => { console.log(`Server running on port ${port}`); });
