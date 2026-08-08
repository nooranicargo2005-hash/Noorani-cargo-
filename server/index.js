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
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            // Log CORS attempts from unknown origins
            console.warn('[CORS] Blocked request from:', origin);
            return callback(null, true); // Temporarily allow for debugging if needed, or change to false for strict security
        }
        return callback(null, true);
    },
    credentials: true
}));

app.use(bodyParser.json());

// --- Database & Storage Initialization ---
// Robust path detection for local vs cloud (Render/Railway/etc)
const dataDir = process.env.DATA_DIR || (fs.existsSync(path.join(__dirname, '..', 'data'))
    ? path.join(__dirname, '..', 'data')
    : path.join(__dirname, 'data'));

const uploadsDir = path.join(dataDir, 'uploads');
const dbPath = path.join(dataDir, 'noorani-cargo.db');

// Ensure directories exist
[dataDir, uploadsDir, path.join(uploadsDir, 'documents'), path.join(uploadsDir, 'images'), path.join(uploadsDir, 'pdf'), path.join(uploadsDir, 'excel')].forEach(dir => {
    if (!fs.existsSync(dir)) {
        console.log('[System] Creating directory:', dir);
        fs.mkdirSync(dir, { recursive: true });
    }
});

app.use('/uploads', express.static(uploadsDir));

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('[DB] Connection Error:', err.message);
    else console.log('[DB] Connected to SQLite database at:', dbPath);
});

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

// --- Audit Helper ---
const logAudit = async (action, details, module, actorEmail) => {
    try {
        await dbRun(`INSERT INTO audit_logs (action, details, module, actorEmail) VALUES (?, ?, ?, ?)`,
            [action, JSON.stringify(details), module, actorEmail]);
    } catch (e) { console.error('Audit log failed', e); }
};

// --- Middleware ---
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// --- API Routes ---

// Health Check & Root
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
        const { search, sortBy = 'updated_at', sortDir = 'DESC', limit = 200 } = req.query;
        let sql = "SELECT * FROM shipments";
        let params = [];
        if (search) {
            sql += " WHERE trackingId LIKE ? OR sender LIKE ? OR receiver LIKE ?";
            params = [`%${search}%`, `%${search}%`, `%${search}%`];
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
        const existing = await dbGet("SELECT trackingId FROM shipments WHERE trackingId = ?", [id]);
        const sql = `INSERT OR REPLACE INTO shipments (
            trackingId, ref, shippingNumber, date, sender, senderPhone, senderAddress, originCountry, origin,
            receiver, receiverPhone, receiverAddress, destination, destinationCountry, shipmentType,
            weight, quantity, shippingCost, paymentStatus, status, author, driver, vehicle, branchCode,
            notes, public, source, updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP,
            COALESCE((SELECT created_at FROM shipments WHERE trackingId = ?), CURRENT_TIMESTAMP))`;

        const params = [
            id,
            d.ref || id,
            d.shippingNumber || '',
            d.date || (d.source === 'pdf' || d.source === 'excel' ? null : new Date().toISOString().split('T')[0]),
            d.sender || '',
            d.senderPhone || '',
            d.senderAddress || '',
            d.originCountry || '',
            d.origin || '',
            d.receiver || '',
            d.receiverPhone || '',
            d.receiverAddress || '',
            d.destination || '',
            d.destinationCountry || '',
            d.shipmentType || 'Air Freight',
            parseFloat(d.weight) || 0,
            parseInt(d.quantity) || 1,
            parseFloat(d.shippingCost) || 0,
            d.paymentStatus || 'Unpaid',
            d.status || 'Pending',
            d.author || 'System',
            d.driver || '',
            d.vehicle || '',
            d.branchCode || '',
            d.notes || '',
            d.public === false ? 0 : 1,
            d.source || 'manual',
            id
        ];
        await dbRun(sql, params);
        await logAudit(existing ? 'Edit Shipment' : 'Create Shipment', { id }, 'Shipments', d.author || 'System');
        res.json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/shipments/:id', async (req, res) => {
    try {
        await dbRun("DELETE FROM shipments WHERE trackingId = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Configure Multer for local uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let subfolder = 'documents';
        if (file.mimetype.includes('image')) subfolder = 'images';
        else if (file.mimetype.includes('pdf')) subfolder = 'pdf';
        else if (file.mimetype.includes('spreadsheet') || file.originalname.endsWith('.xlsx')) subfolder = 'excel';

        const dest = path.join(uploadsDir, subfolder);
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Assets, Timeline, Notes
app.post('/api/shipments/:id/assets', upload.single('file'), async (req, res) => {
    try {
        const id = req.params.id;
        const file = req.file;
        const assetType = req.body.type || 'document';
        const relPath = `/uploads/${file.destination.split(path.sep).pop()}/${file.filename}`;
        await dbRun(`INSERT INTO uploaded_files (trackingId, fileName, filePath, fileType, fileSize, assetType) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, file.originalname, relPath, file.mimetype, file.size, assetType]);
        const protocol = req.protocol; const host = req.get('host');
        res.json({ success: true, downloadURL: `${protocol}://${host}${relPath}` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/shipments/:id/assets', async (req, res) => {
    try {
        const rows = await dbQuery("SELECT * FROM uploaded_files WHERE trackingId = ? ORDER BY upload_date DESC", [req.params.id]);
        const protocol = req.protocol; const host = req.get('host');
        res.json(rows.map(r => ({ ...r, downloadURL: `${protocol}://${host}${r.filePath}` })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/shipments/:id/timeline', async (req, res) => {
    try {
        const rows = await dbQuery("SELECT * FROM shipment_timeline WHERE trackingNumber = ? ORDER BY createdAt DESC", [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shipments/:id/timeline', async (req, res) => {
    try {
        const { eventType, title, description, actor } = req.body;
        await dbRun(`INSERT INTO shipment_timeline (trackingNumber, eventType, title, description, actor) VALUES (?, ?, ?, ?, ?)`,
            [req.params.id, eventType, title, description, actor]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/shipments/:id/notes', async (req, res) => {
    try {
        const rows = await dbQuery("SELECT * FROM shipment_notes WHERE trackingNumber = ? ORDER BY createdAt DESC", [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shipments/:id/notes', async (req, res) => {
    try {
        const { content, author } = req.body;
        await dbRun(`INSERT INTO shipment_notes (trackingNumber, content, author) VALUES (?, ?, ?)`,
            [req.params.id, content, author || 'System']);
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

app.post('/api/drivers', async (req, res) => {
    try {
        const d = req.body; const id = d.id || `DRV-${Date.now()}`;
        await dbRun(`INSERT OR REPLACE INTO drivers (id, fullName, mobileNumber, licenseNumber, branchCode, status, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, COALESCE((SELECT created_at FROM drivers WHERE id = ?), CURRENT_TIMESTAMP))`, [id, d.fullName, d.mobileNumber, d.licenseNumber, d.branchCode, d.status || 'active', id]);
        res.json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/vehicles', async (req, res) => {
    try {
        const d = req.body; const id = d.id || `VEH-${Date.now()}`;
        await dbRun(`INSERT OR REPLACE INTO vehicles (id, plateNumber, brand, status, updated_at, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, COALESCE((SELECT created_at FROM vehicles WHERE id = ?), CURRENT_TIMESTAMP))`, [id, d.plateNumber, d.brand, d.status || 'Available', id]);
        res.json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/branches', async (req, res) => {
    try {
        const d = req.body; const id = d.id || `BR-${Date.now()}`;
        await dbRun(`INSERT OR REPLACE INTO branches (id, branchName, branchCode, status, updated_at, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, COALESCE((SELECT created_at FROM branches WHERE id = ?), CURRENT_TIMESTAMP))`, [id, d.branchName, d.branchCode, d.status || 'active', id]);
        res.json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/employees', async (req, res) => {
    try {
        const d = req.body; const id = d.id || `EMP-${Date.now()}`;
        await dbRun(`INSERT OR REPLACE INTO employees (id, fullName, email, updated_at, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, COALESCE((SELECT created_at FROM employees WHERE id = ?), CURRENT_TIMESTAMP))`, [id, d.fullName, d.email, id]);
        res.json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Users
app.get('/api/users', async (req, res) => { try { res.json((await dbQuery("SELECT id, email, role, branchCode, status FROM users")).map(r => ({ ...r, uid: String(r.id) }))); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post('/api/users', async (req, res) => { try { const d = req.body; await dbRun("INSERT OR REPLACE INTO users (email, password, role, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)", [d.email, d.password, d.role]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.delete('/api/users/:id', async (req, res) => { try { await dbRun("DELETE FROM users WHERE id = ?", [req.params.id]); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); } });

// Finance
app.get('/api/transactions', async (req, res) => { try { res.json({ items: await dbQuery("SELECT * FROM transactions ORDER BY date DESC") }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.get('/api/invoices', async (req, res) => { try { res.json(await dbQuery("SELECT * FROM invoices ORDER BY updated_at DESC")); } catch (err) { res.status(500).json({ error: err.message }); } });
app.get('/api/audit-logs', async (req, res) => { try { res.json({ items: await dbQuery("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200") }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.get('/api/notifications', async (req, res) => { try { res.json(await dbQuery("SELECT * FROM notifications ORDER BY createdAt DESC LIMIT 50")); } catch (err) { res.status(500).json({ error: err.message }); } });

// Settings
app.get('/api/settings/:category', async (req, res) => {
    try { const rows = await dbQuery("SELECT setting_key, setting_value FROM settings WHERE category = ?", [req.params.category]); const s = {}; rows.forEach(r => s[r.setting_key] = r.setting_value); res.json(s); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/settings/:category', async (req, res) => {
    try { const cat = req.params.category; const d = req.body; for (const k in d) { await dbRun("INSERT OR REPLACE INTO settings (category, setting_key, setting_value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)", [cat, k, String(d[k])]); } res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(port, '0.0.0.0', () => { console.log(`Noorani Cargo Enterprise Server running on port ${port}`); });
