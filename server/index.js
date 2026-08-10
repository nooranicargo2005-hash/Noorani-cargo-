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
            // In production, we should probably be stricter, but keeping it open for now to ensure connectivity
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

        // Add new columns for Excel format if they don't exist
        const newCols = [
            { name: 'swbSerial', type: 'TEXT' },
            { name: 'customerInvoice', type: 'TEXT' },
            { name: 'originalWeight', type: 'REAL' },
            { name: 'originalQuantity', type: 'INTEGER' }
        ];
        newCols.forEach(col => {
            db.run(`ALTER TABLE shipments ADD COLUMN ${col.name} ${col.type}`, err => {
                // Silently ignore "duplicate column name" error
            });
        });
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
        const { search, status, paymentStatus, sortBy = 'updated_at', sortDir = 'DESC', limit = 1000 } = req.query;
        let sql = "SELECT * FROM shipments WHERE 1=1";
        let params = [];

        if (status) {
            sql += " AND status = ?";
            params.push(status);
        }
        if (paymentStatus) {
            sql += " AND paymentStatus = ?";
            params.push(paymentStatus);
        }
        if (search) {
            sql += " AND (trackingId LIKE ? OR sender LIKE ? OR receiver LIKE ? OR senderPhone LIKE ? OR receiverPhone LIKE ? OR swbSerial LIKE ?)";
            const p = `%${search}%`;
            params.push(p, p, p, p, p, p);
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
        const existing = await dbGet("SELECT * FROM shipments WHERE trackingId = ?", [id]);

        const sql = `INSERT OR REPLACE INTO shipments (
            trackingId, ref, shippingNumber, date, sender, senderPhone, senderAddress, originCountry, origin,
            receiver, receiverPhone, receiverAddress, destination, destinationCountry, shipmentType,
            originalWeight, weight, originalQuantity, quantity, shippingCost, paymentStatus,
            branchCode, status, notes, author, driver, vehicle, public, source,
            swbSerial, customerInvoice, updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`;

        const params = [
            id,
            d.ref !== undefined ? d.ref : (existing ? existing.ref : ''),
            d.shippingNumber !== undefined ? d.shippingNumber : (existing ? existing.shippingNumber : ''),
            d.date !== undefined ? d.date : (existing ? existing.date : new Date().toISOString().split('T')[0]),
            d.sender !== undefined ? d.sender : (existing ? existing.sender : ''),
            d.senderPhone !== undefined ? d.senderPhone : (existing ? existing.senderPhone : ''),
            d.senderAddress !== undefined ? d.senderAddress : (existing ? existing.senderAddress : ''),
            d.originCountry !== undefined ? d.originCountry : (existing ? existing.originCountry : ''),
            d.origin !== undefined ? d.origin : (existing ? existing.origin : ''),
            d.receiver !== undefined ? d.receiver : (existing ? existing.receiver : ''),
            d.receiverPhone !== undefined ? d.receiverPhone : (existing ? existing.receiverPhone : ''),
            d.receiverAddress !== undefined ? d.receiverAddress : (existing ? existing.receiverAddress : ''),
            d.destination !== undefined ? d.destination : (existing ? existing.destination : ''),
            d.destinationCountry !== undefined ? d.destinationCountry : (existing ? existing.destinationCountry : ''),
            d.shipmentType !== undefined ? d.shipmentType : (existing ? existing.shipmentType : 'Air Freight'),
            d.originalWeight !== undefined ? parseFloat(d.originalWeight) : (existing ? existing.originalWeight : 0),
            d.weight !== undefined ? parseFloat(d.weight) : (existing ? existing.weight : 0),
            d.originalQuantity !== undefined ? parseInt(d.originalQuantity) : (existing ? existing.originalQuantity : 1),
            d.quantity !== undefined ? parseInt(d.quantity) : (existing ? existing.quantity : 1),
            d.shippingCost !== undefined ? parseFloat(d.shippingCost) : (existing ? existing.shippingCost : 0),
            d.paymentStatus !== undefined ? d.paymentStatus : (existing ? existing.paymentStatus : 'Unpaid'),
            d.branchCode !== undefined ? d.branchCode : (existing ? existing.branchCode : ''),
            d.status !== undefined ? d.status : (existing ? existing.status : 'Pending'),
            d.notes !== undefined ? d.notes : (existing ? existing.notes : ''),
            d.author !== undefined ? d.author : (existing ? existing.author : 'System'),
            d.driver !== undefined ? d.driver : (existing ? existing.driver : ''),
            d.vehicle !== undefined ? d.vehicle : (existing ? existing.vehicle : ''),
            d.public !== undefined ? (d.public === false ? 0 : 1) : (existing ? (existing.public !== undefined ? existing.public : 1) : 1),
            d.source !== undefined ? d.source : (existing ? existing.source : 'manual'),
            d.swbSerial !== undefined ? d.swbSerial : (existing ? existing.swbSerial : ''),
            d.customerInvoice !== undefined ? d.customerInvoice : (existing ? existing.customerInvoice : ''),
            existing ? existing.created_at : new Date().toISOString()
        ];

        await dbRun(sql, params);
        res.json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Shipment Timeline
app.get('/api/shipments/:id/timeline', async (req, res) => {
    try { res.json(await dbQuery("SELECT * FROM shipment_timeline WHERE trackingNumber = ? ORDER BY createdAt DESC", [req.params.id])); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shipments/:id/timeline', async (req, res) => {
    try {
        const d = req.body;
        await dbRun("INSERT INTO shipment_timeline (trackingNumber, eventType, title, description, actor) VALUES (?, ?, ?, ?, ?)",
            [req.params.id, d.eventType, d.title, d.description, d.actor]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Shipment Notes
app.get('/api/shipments/:id/notes', async (req, res) => {
    try { res.json(await dbQuery("SELECT * FROM shipment_notes WHERE trackingNumber = ? ORDER BY createdAt DESC", [req.params.id])); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shipments/:id/notes', async (req, res) => {
    try {
        const d = req.body;
        await dbRun("INSERT INTO shipment_notes (trackingNumber, content, author) VALUES (?, ?, ?)",
            [req.params.id, d.content, d.author || 'System']);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Shipment Assets
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let sub = 'documents';
        if (file.mimetype.startsWith('image/')) sub = 'images';
        else if (file.mimetype === 'application/pdf') sub = 'pdf';
        cb(null, path.join(uploadsDir, sub));
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

app.get('/api/shipments/:id/assets', async (req, res) => {
    try {
        const rows = await dbQuery("SELECT * FROM uploaded_files WHERE trackingId = ?", [req.params.id]);
        res.json(rows.map(r => ({ ...r, downloadURL: `/uploads/${r.assetType || 'documents'}/${r.fileName}` })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shipments/:id/assets', upload.single('file'), async (req, res) => {
    try {
        const id = req.params.id;
        const file = req.file;
        const assetType = req.body.type || (file.mimetype.startsWith('image/') ? 'images' : 'documents');
        await dbRun("INSERT INTO uploaded_files (trackingId, fileName, filePath, fileType, fileSize, assetType) VALUES (?, ?, ?, ?, ?, ?)",
            [id, file.filename, file.path, file.mimetype, file.size, assetType]);
        res.json({ success: true, fileName: file.filename });
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
        try {
            const { search } = req.query;
            let sql = `SELECT * FROM ${table}`;
            let params = [];
            if (search) {
                sql += ` WHERE fullName LIKE ? OR id LIKE ?`;
                params = [`%${search}%`, `%${search}%`];
            }
            sql += ` ORDER BY updated_at DESC`;
            res.json({ items: await dbQuery(sql, params) });
        } catch (err) { res.status(500).json({ error: err.message }); }
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
        const existing = await dbGet("SELECT * FROM customers WHERE id = ?", [id]);
        const sql = `INSERT OR REPLACE INTO customers (
            id, fullName, companyName, mobileNumber, whatsAppNumber, email, nationalId, address, city, country, postalCode, customerType, notes, status, updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`;
        await dbRun(sql, [
            id,
            d.fullName !== undefined ? d.fullName : (existing ? existing.fullName : ''),
            d.companyName !== undefined ? d.companyName : (existing ? existing.companyName : ''),
            d.mobileNumber !== undefined ? d.mobileNumber : (existing ? existing.mobileNumber : ''),
            d.whatsAppNumber !== undefined ? d.whatsAppNumber : (existing ? existing.whatsAppNumber : ''),
            d.email !== undefined ? d.email : (existing ? existing.email : ''),
            d.nationalId !== undefined ? d.nationalId : (existing ? existing.nationalId : ''),
            d.address !== undefined ? d.address : (existing ? existing.address : ''),
            d.city !== undefined ? d.city : (existing ? existing.city : ''),
            d.country !== undefined ? d.country : (existing ? existing.country : ''),
            d.postalCode !== undefined ? d.postalCode : (existing ? existing.postalCode : ''),
            d.customerType !== undefined ? d.customerType : (existing ? existing.customerType : 'Individual'),
            d.notes !== undefined ? d.notes : (existing ? existing.notes : ''),
            d.status !== undefined ? d.status : (existing ? existing.status : 'active'),
            existing ? existing.created_at : new Date().toISOString()
        ]);
        res.json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/drivers', async (req, res) => {
    try {
        const d = req.body; const id = d.id || `DRV-${Date.now()}`;
        const existing = await dbGet("SELECT * FROM drivers WHERE id = ?", [id]);
        const sql = `INSERT OR REPLACE INTO drivers (
            id, fullName, email, mobileNumber, whatsAppNumber, nationalId, licenseNumber, licenseExpiry, branchCode, assignedVehicle, address, emergencyContact, notes, status, dateOfJoining, updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`;
        await dbRun(sql, [
            id,
            d.fullName !== undefined ? d.fullName : (existing ? existing.fullName : ''),
            d.email !== undefined ? d.email : (existing ? existing.email : ''),
            d.mobileNumber !== undefined ? d.mobileNumber : (existing ? existing.mobileNumber : ''),
            d.whatsAppNumber !== undefined ? d.whatsAppNumber : (existing ? existing.whatsAppNumber : ''),
            d.nationalId !== undefined ? d.nationalId : (existing ? existing.nationalId : ''),
            d.licenseNumber !== undefined ? d.licenseNumber : (existing ? existing.licenseNumber : ''),
            d.licenseExpiry !== undefined ? d.licenseExpiry : (existing ? existing.licenseExpiry : ''),
            d.branchCode !== undefined ? d.branchCode : (existing ? existing.branchCode : ''),
            d.assignedVehicle !== undefined ? d.assignedVehicle : (existing ? existing.assignedVehicle : ''),
            d.address !== undefined ? d.address : (existing ? existing.address : ''),
            d.emergencyContact !== undefined ? d.emergencyContact : (existing ? existing.emergencyContact : ''),
            d.notes !== undefined ? d.notes : (existing ? existing.notes : ''),
            d.status !== undefined ? d.status : (existing ? existing.status : 'active'),
            d.dateOfJoining !== undefined ? d.dateOfJoining : (existing ? existing.dateOfJoining : ''),
            existing ? existing.created_at : new Date().toISOString()
        ]);
        res.json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/vehicles', async (req, res) => {
    try {
        const d = req.body; const id = d.id || `VEH-${Date.now()}`;
        const existing = await dbGet("SELECT * FROM vehicles WHERE id = ?", [id]);
        const sql = `INSERT OR REPLACE INTO vehicles (
            id, plateNumber, brand, model, year, vehicleType, registrationNumber, registrationExpiry, insuranceExpiry, chassisNumber, engineNumber, capacity, fuelType, assignedDriver, assignedBranch, currentMileage, status, notes, updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`;
        await dbRun(sql, [
            id,
            d.plateNumber !== undefined ? d.plateNumber : (existing ? existing.plateNumber : ''),
            d.brand !== undefined ? d.brand : (existing ? existing.brand : ''),
            d.model !== undefined ? d.model : (existing ? existing.model : ''),
            d.year !== undefined ? d.year : (existing ? existing.year : ''),
            d.vehicleType !== undefined ? d.vehicleType : (existing ? existing.vehicleType : ''),
            d.registrationNumber !== undefined ? d.registrationNumber : (existing ? existing.registrationNumber : ''),
            d.registrationExpiry !== undefined ? d.registrationExpiry : (existing ? existing.registrationExpiry : ''),
            d.insuranceExpiry !== undefined ? d.insuranceExpiry : (existing ? existing.insuranceExpiry : ''),
            d.chassisNumber !== undefined ? d.chassisNumber : (existing ? existing.chassisNumber : ''),
            d.engineNumber !== undefined ? d.engineNumber : (existing ? existing.engineNumber : ''),
            d.capacity !== undefined ? d.capacity : (existing ? existing.capacity : ''),
            d.fuelType !== undefined ? d.fuelType : (existing ? existing.fuelType : ''),
            d.assignedDriver !== undefined ? d.assignedDriver : (existing ? existing.assignedDriver : ''),
            d.assignedBranch !== undefined ? d.assignedBranch : (existing ? existing.assignedBranch : ''),
            d.currentMileage !== undefined ? parseFloat(d.currentMileage) : (existing ? existing.currentMileage : 0),
            d.status !== undefined ? d.status : (existing ? existing.status : 'Available'),
            d.notes !== undefined ? d.notes : (existing ? existing.notes : ''),
            existing ? existing.created_at : new Date().toISOString()
        ]);
        res.json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/branches', async (req, res) => {
    try {
        const d = req.body; const id = d.id || `BR-${Date.now()}`;
        const existing = await dbGet("SELECT * FROM branches WHERE id = ?", [id]);
        const sql = `INSERT OR REPLACE INTO branches (
            id, branchName, branchCode, managerName, phoneNumber, whatsAppNumber, email, address, city, state, country, postalCode, googleMaps, timeZone, workingHours, status, notes, updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`;
        await dbRun(sql, [
            id,
            d.branchName !== undefined ? d.branchName : (existing ? existing.branchName : ''),
            d.branchCode !== undefined ? d.branchCode : (existing ? existing.branchCode : ''),
            d.managerName !== undefined ? d.managerName : (existing ? existing.managerName : ''),
            d.phoneNumber !== undefined ? d.phoneNumber : (existing ? existing.phoneNumber : ''),
            d.whatsAppNumber !== undefined ? d.whatsAppNumber : (existing ? existing.whatsAppNumber : ''),
            d.email !== undefined ? d.email : (existing ? existing.email : ''),
            d.address !== undefined ? d.address : (existing ? existing.address : ''),
            d.city !== undefined ? d.city : (existing ? existing.city : ''),
            d.state !== undefined ? d.state : (existing ? existing.state : ''),
            d.country !== undefined ? d.country : (existing ? existing.country : ''),
            d.postalCode !== undefined ? d.postalCode : (existing ? existing.postalCode : ''),
            d.googleMaps !== undefined ? d.googleMaps : (existing ? existing.googleMaps : ''),
            d.timeZone !== undefined ? d.timeZone : (existing ? existing.timeZone : ''),
            d.workingHours !== undefined ? d.workingHours : (existing ? existing.workingHours : ''),
            d.status !== undefined ? d.status : (existing ? existing.status : 'active'),
            d.notes !== undefined ? d.notes : (existing ? existing.notes : ''),
            existing ? existing.created_at : new Date().toISOString()
        ]);
        res.json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/employees', async (req, res) => {
    try {
        const d = req.body; const id = d.id || `EMP-${Date.now()}`;
        const existing = await dbGet("SELECT * FROM employees WHERE id = ?", [id]);
        const sql = `INSERT OR REPLACE INTO employees (
            id, fullName, fatherName, dob, gender, email, mobileNumber, whatsAppNumber, nationalId, address, designation, department, assignedBranch, employmentType, employmentStatus, dateOfJoining, basicSalary, emergencyContactName, emergencyContactPhone, notes, updated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`;
        await dbRun(sql, [
            id,
            d.fullName !== undefined ? d.fullName : (existing ? existing.fullName : ''),
            d.fatherName !== undefined ? d.fatherName : (existing ? existing.fatherName : ''),
            d.dob !== undefined ? d.dob : (existing ? existing.dob : ''),
            d.gender !== undefined ? d.gender : (existing ? existing.gender : ''),
            d.email !== undefined ? d.email : (existing ? existing.email : ''),
            d.mobileNumber !== undefined ? d.mobileNumber : (existing ? existing.mobileNumber : ''),
            d.whatsAppNumber !== undefined ? d.whatsAppNumber : (existing ? existing.whatsAppNumber : ''),
            d.nationalId !== undefined ? d.nationalId : (existing ? existing.nationalId : ''),
            d.address !== undefined ? d.address : (existing ? existing.address : ''),
            d.designation !== undefined ? d.designation : (existing ? existing.designation : ''),
            d.department !== undefined ? d.department : (existing ? existing.department : ''),
            d.assignedBranch !== undefined ? d.assignedBranch : (existing ? existing.assignedBranch : ''),
            d.employmentType !== undefined ? d.employmentType : (existing ? existing.employmentType : 'Full-Time'),
            d.employmentStatus !== undefined ? d.employmentStatus : (existing ? existing.employmentStatus : 'Active'),
            d.dateOfJoining !== undefined ? d.dateOfJoining : (existing ? existing.dateOfJoining : ''),
            d.basicSalary !== undefined ? parseFloat(d.basicSalary) : (existing ? existing.basicSalary : 0),
            d.emergencyContactName !== undefined ? d.emergencyContactName : (existing ? existing.emergencyContactName : ''),
            d.emergencyContactPhone !== undefined ? d.emergencyContactPhone : (existing ? existing.emergencyContactPhone : ''),
            d.notes !== undefined ? d.notes : (existing ? existing.notes : ''),
            existing ? existing.created_at : new Date().toISOString()
        ]);
        res.json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Finance
app.get('/api/transactions', async (req, res) => {
    try { res.json({ items: await dbQuery("SELECT * FROM transactions ORDER BY date DESC, updated_at DESC") }); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/transactions', async (req, res) => {
    try {
        const d = req.body; const id = d.id || `TXN-${Date.now()}`;
        const sql = `INSERT OR REPLACE INTO transactions (id, type, category, description, amount, date, paymentMethod, status, shipmentRef, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, COALESCE((SELECT created_at FROM transactions WHERE id = ?), CURRENT_TIMESTAMP))`;
        await dbRun(sql, [id, d.type, d.category, d.description, parseFloat(d.amount) || 0, d.date, d.paymentMethod, d.status || 'Paid', d.shipmentRef || '', id]);
        res.json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/transactions/:id', async (req, res) => {
    try { await dbRun("DELETE FROM transactions WHERE id = ?", [req.params.id]); res.json({ success: true }); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

// Audit Logs
app.get('/api/audit-logs', async (req, res) => {
    try { res.json({ items: await dbQuery("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500") }); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

// Notifications
app.get('/api/notifications', async (req, res) => {
    try { res.json(await dbQuery("SELECT * FROM notifications ORDER BY createdAt DESC LIMIT 100")); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/notifications', async (req, res) => {
    try { await dbRun("DELETE FROM notifications"); res.json({ success: true }); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

// Settings
app.get('/api/settings/:category', async (req, res) => {
    try { res.json(await dbQuery("SELECT * FROM settings WHERE category = ?", [req.params.category])); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings/:category', async (req, res) => {
    try {
        const { settings } = req.body; // Expecting { settings: { key: value, ... } }
        const category = req.params.category;
        for (const [key, value] of Object.entries(settings)) {
            await dbRun("INSERT OR REPLACE INTO settings (category, setting_key, setting_value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)", [category, key, String(value)]);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Users
app.get('/api/users', async (req, res) => { try { res.json((await dbQuery("SELECT id, email, role, branchCode, status FROM users")).map(r => ({ ...r, uid: String(r.id) }))); } catch (err) { res.status(500).json({ error: err.message }); } });

app.post('/api/users', async (req, res) => {
    try {
        const d = req.body;
        const sql = `INSERT OR REPLACE INTO users (displayName, email, password, role, branchCode, status, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
        await dbRun(sql, [d.displayName || '', d.email, d.password, d.role || 'employee', d.branchCode || '', d.status || 'enabled']);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
    try { await dbRun("DELETE FROM users WHERE id = ?", [req.params.id]); res.json({ success: true }); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(port, '0.0.0.0', () => { console.log(`Server running on port ${port}`); });
