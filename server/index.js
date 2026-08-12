require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('[System] CRITICAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
        if (allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        }
        // In development we might allow all, but for production we should be strict
        console.warn('[CORS] Origin Blocked or Warned:', origin);
        return callback(null, true);
    },
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- Storage Initialization ---
const dataDir = process.env.DATA_DIR || (fs.existsSync(path.join(__dirname, '..', 'data'))
    ? path.join(__dirname, '..', 'data')
    : path.join(__dirname, 'data'));

const manifestsDir = path.join(dataDir, 'manifests');
const uploadsDir = path.join(dataDir, 'uploads');

console.log('[System] Data Directory:', dataDir);
console.log('[System] Manifests Storage:', manifestsDir);

const dirsToCreate = [
    dataDir,
    manifestsDir,
    uploadsDir,
    path.join(uploadsDir, 'documents'),
    path.join(uploadsDir, 'images'),
    path.join(uploadsDir, 'pdf'),
    path.join(uploadsDir, 'excel')
];

dirsToCreate.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

app.use('/uploads', express.static(uploadsDir));

// --- API Routes ---

app.get('/', (req, res) => res.send('NOORANI CARGO SERVICES Enterprise API is online (Supabase Mode).'));
app.get('/api/health', async (req, res) => {
    try {
        const { error } = await supabase.from('shipments').select('count', { count: 'exact', head: true });
        res.json({
            status: 'ok',
            timestamp: new Date(),
            environment: process.env.NODE_ENV || 'development',
            dbConnected: !error,
            dbError: error ? error.message : null
        });
    } catch (err) {
        res.json({ status: 'error', error: err.message });
    }
});

// Dashboard Stats
app.get('/api/stats/dashboard', async (req, res) => {
    try {
        const { count: totalShipments } = await supabase.from('shipments').select('*', { count: 'exact', head: true });
        const { count: delivered } = await supabase.from('shipments').select('*', { count: 'exact', head: true }).ilike('status', '%Delivered%');
        const { count: inTransit } = await supabase.from('shipments').select('*', { count: 'exact', head: true }).not('status', 'in', ['Pending', 'Delivered to Customer', 'Cancelled']);
        const { count: pending } = await supabase.from('shipments').select('*', { count: 'exact', head: true }).eq('status', 'Pending');
        const { count: cancelled } = await supabase.from('shipments').select('*', { count: 'exact', head: true }).eq('status', 'Cancelled');

        const { data: revData } = await supabase.from('shipments').select('shippingCost').eq('paymentStatus', 'Paid');
        const totalRevenue = revData?.reduce((acc, curr) => acc + (parseFloat(curr.shippingCost) || 0), 0) || 0;

        const { data: expData } = await supabase.from('transactions').select('amount').eq('type', 'expense');
        const totalExpenses = expData?.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0) || 0;

        res.json({
            totalShipments: totalShipments || 0,
            delivered: delivered || 0,
            inTransit: inTransit || 0,
            pending: pending || 0,
            cancelled: cancelled || 0,
            totalRevenue,
            totalExpenses,
            profit: totalRevenue - totalExpenses
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Shipments
app.get('/api/shipments', async (req, res) => {
    try {
        const { search, status, paymentStatus, sortBy, sortDir = 'DESC', limit = 50 } = req.query;
        let query = supabase.from('shipments').select('*');

        if (status && status.trim() !== '') query = query.eq('status', status);
        if (paymentStatus && paymentStatus.trim() !== '') query = query.eq('paymentStatus', paymentStatus);

        if (search && search.trim() !== '') {
            // Using quotes for case-sensitive column names in raw .or() string
            query = query.or(`"trackingId".ilike.%${search}%,sender.ilike.%${search}%,receiver.ilike.%${search}%,"senderPhone".ilike.%${search}%,"receiverPhone".ilike.%${search}%,"swbSerial".ilike.%${search}%,"customerInvoice".ilike.%${search}%`);
        }

        const finalSortBy = sortBy && sortBy.trim() !== '' ? sortBy : 'updated_at';
        const finalLimit = parseInt(limit, 10) || 50;

        query = query.order(finalSortBy, { ascending: sortDir === 'ASC' }).limit(finalLimit);

        const { data, error } = await query;

        // Fallback for missing updated_at or other column issues
        if (error) {
             console.warn('[API] Query error, attempting fallback:', error.message);
             const fallbackQuery = supabase.from('shipments').select('*');
             if (status && status.trim() !== '') fallbackQuery.eq('status', status);
             if (paymentStatus && paymentStatus.trim() !== '') fallbackQuery.eq('paymentStatus', paymentStatus);
             if (search && search.trim() !== '') {
                 fallbackQuery.or(`"trackingId".ilike.%${search}%,sender.ilike.%${search}%,receiver.ilike.%${search}%`);
             }
             const fallbackRes = await fallbackQuery.limit(finalLimit);
             if (fallbackRes.error) throw fallbackRes.error;
             return res.json({ items: (fallbackRes.data || []).map(r => ({ trackingId: r.trackingId || r.trackingid, data: r })) });
        }

        res.json({ items: (data || []).map(r => ({ trackingId: r.trackingId || r.trackingid, data: r })) });
    } catch (err) {
        console.error('[API] Fatal Shipments Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/shipments/:id', async (req, res) => {
    try {
        const id = req.params.id;
        // Search by trackingId OR swbSerial OR shippingNumber OR customerInvoice
        // Using quotes for case-sensitive column names
        const { data, error } = await supabase.from('shipments')
            .select('*')
            .or(`"trackingId".eq.${id},"swbSerial".eq.${id},"shippingNumber".eq.${id},"customerInvoice".eq.${id}`)
            .limit(1)
            .maybeSingle();

        if (error) {
            // Fallback for case-insensitive or different schema
            const { data: fallbackData, error: fallbackError } = await supabase.from('shipments')
                .select('*')
                .or(`trackingid.eq.${id},swbserial.eq.${id},shippingnumber.eq.${id},customerinvoice.eq.${id}`)
                .limit(1)
                .maybeSingle();

            if (fallbackError || !fallbackData) throw error || fallbackError;
            const tid = fallbackData.trackingId || fallbackData.trackingid;
            return res.json({ trackingId: tid, data: fallbackData });
        }

        if (!data) return res.status(404).json({ error: "Not found" });
        const tid = data.trackingId || data.trackingid;
        res.json({ trackingId: tid, data: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shipments/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const d = req.body;

        // Fetch existing for merge logic to maintain original behavior
        const { data: existing } = await supabase.from('shipments').select('*').eq('trackingId', id).maybeSingle();

        const status = d.status !== undefined ? d.status : (existing ? existing.status : 'Pending');
        let statusDate = d.statusDate !== undefined ? d.statusDate : (existing ? existing.statusDate : new Date().toISOString());

        // Update statusDate automatically if status changed and no explicit statusDate provided
        if (existing && d.status !== undefined && d.status !== existing.status && d.statusDate === undefined) {
            statusDate = new Date().toISOString();
        }

        const shipmentData = {
            trackingId: id,
            ref: d.ref !== undefined ? d.ref : (existing ? existing.ref : ''),
            shippingNumber: d.shippingNumber !== undefined ? d.shippingNumber : (existing ? existing.shippingNumber : ''),
            date: d.date !== undefined ? d.date : (existing ? existing.date : new Date().toISOString().split('T')[0]),
            sender: d.sender !== undefined ? d.sender : (existing ? existing.sender : ''),
            senderPhone: d.senderPhone !== undefined ? d.senderPhone : (existing ? existing.senderPhone : ''),
            senderAddress: d.senderAddress !== undefined ? d.senderAddress : (existing ? existing.senderAddress : ''),
            originCountry: d.originCountry !== undefined ? d.originCountry : (existing ? existing.originCountry : ''),
            origin: d.origin !== undefined ? d.origin : (existing ? existing.origin : ''),
            receiver: d.receiver !== undefined ? d.receiver : (existing ? existing.receiver : ''),
            receiverPhone: d.receiverPhone !== undefined ? d.receiverPhone : (existing ? existing.receiverPhone : ''),
            receiverAddress: d.receiverAddress !== undefined ? d.receiverAddress : (existing ? existing.receiverAddress : ''),
            destination: d.destination !== undefined ? d.destination : (existing ? existing.destination : ''),
            destinationCountry: d.destinationCountry !== undefined ? d.destinationCountry : (existing ? existing.destinationCountry : ''),
            shipmentType: d.shipmentType !== undefined ? d.shipmentType : (existing ? existing.shipmentType : 'Air Freight'),
            originalWeight: d.originalWeight !== undefined ? (parseFloat(d.originalWeight) || 0) : (existing ? existing.originalWeight : 0),
            weight: d.weight !== undefined ? (parseFloat(d.weight) || 0) : (existing ? existing.weight : 0),
            originalQuantity: d.originalQuantity !== undefined ? (parseInt(d.originalQuantity) || 1) : (existing ? existing.originalQuantity : 1),
            quantity: d.quantity !== undefined ? (parseInt(d.quantity) || 1) : (existing ? existing.quantity : 1),
            shippingCost: d.shippingCost !== undefined ? (parseFloat(d.shippingCost) || 0) : (existing ? existing.shippingCost : 0),
            paymentStatus: d.paymentStatus !== undefined ? d.paymentStatus : (existing ? existing.paymentStatus : 'Unpaid'),
            branchCode: d.branchCode !== undefined ? d.branchCode : (existing ? existing.branchCode : ''),
            status: status,
            statusDate: statusDate,
            paidDate: d.paidDate !== undefined ? d.paidDate : (existing ? existing.paidDate : ''),
            notes: d.notes !== undefined ? d.notes : (existing ? existing.notes : ''),
            author: d.author !== undefined ? d.author : (existing ? existing.author : 'System'),
            public: d.public !== undefined ? (d.public === false ? 0 : 1) : (existing ? (existing.public !== undefined ? existing.public : 1) : 1),
            source: d.source !== undefined ? d.source : (existing ? existing.source : 'manual'),
            swbSerial: d.swbSerial !== undefined ? d.swbSerial : (existing ? existing.swbSerial : ''),
            customerInvoice: d.customerInvoice !== undefined ? d.customerInvoice : (existing ? existing.customerInvoice : ''),
            swbDate: d.swbDate !== undefined ? d.swbDate : (existing ? existing.swbDate : ''),
            driver: d.driver !== undefined ? d.driver : (existing ? existing.driver : ''),
            vehicle: d.vehicle !== undefined ? d.vehicle : (existing ? existing.vehicle : ''),
            route: d.route !== undefined ? d.route : (existing ? existing.route : ''),
            milestone1: d.milestone1 !== undefined ? d.milestone1 : (existing ? existing.milestone1 : ''),
            milestone2: d.milestone2 !== undefined ? d.milestone2 : (existing ? existing.milestone2 : ''),
            milestone3: d.milestone3 !== undefined ? d.milestone3 : (existing ? existing.milestone3 : ''),
            milestone4: d.milestone4 !== undefined ? d.milestone4 : (existing ? existing.milestone4 : ''),
            milestone5: d.milestone5 !== undefined ? d.milestone5 : (existing ? existing.milestone5 : ''),
            milestone6: d.milestone6 !== undefined ? d.milestone6 : (existing ? existing.milestone6 : ''),
            updated_at: new Date().toISOString(),
            created_at: existing ? existing.created_at : new Date().toISOString()
        };

        const { error } = await supabase.from('shipments').upsert(shipmentData, { onConflict: 'trackingId' });
        if (error) throw error;

        // --- Idempotent Finance Automation ---
        if (shipmentData.paymentStatus === 'Paid' && shipmentData.shippingCost > 0) {
            // Check if income transaction already exists for this shipment
            const { data: existingTxn } = await supabase.from('transactions')
                .select('id')
                .eq('shipmentRef', id)
                .eq('type', 'income')
                .maybeSingle();

            if (!existingTxn) {
                const txnId = `AUTO-${id}-${Date.now()}`;
                await supabase.from('transactions').insert({
                    id: txnId,
                    type: 'income',
                    category: 'Shipment Payment',
                    description: `Automated payment record for shipment ${id}`,
                    amount: shipmentData.shippingCost,
                    date: shipmentData.paidDate || new Date().toISOString().split('T')[0],
                    paymentMethod: 'Other',
                    status: 'Paid',
                    shipmentRef: id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            }
        }

        res.json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Shipment Timeline
app.get('/api/shipments/:id/timeline', async (req, res) => {
    try {
        const { data, error } = await supabase.from('shipment_timeline').select('*').eq('trackingNumber', req.params.id).order('createdAt', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shipments/:id/timeline', async (req, res) => {
    try {
        const d = req.body;
        const { error } = await supabase.from('shipment_timeline').insert({
            trackingNumber: req.params.id,
            eventType: d.eventType,
            title: d.title,
            description: d.description,
            actor: d.actor
        });
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Shipment Notes
app.get('/api/shipments/:id/notes', async (req, res) => {
    try {
        const { data, error } = await supabase.from('shipment_notes').select('*').eq('trackingNumber', req.params.id).order('createdAt', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shipments/:id/notes', async (req, res) => {
    try {
        const d = req.body;
        const { error } = await supabase.from('shipment_notes').insert({
            trackingNumber: req.params.id,
            content: d.content,
            author: d.author || 'System'
        });
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Shipment Assets (Multer remains same for local file storage)
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

const manifestStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const targetPath = path.resolve(manifestsDir);
        if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath, { recursive: true });
        cb(null, targetPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const uploadManifest = multer({ storage: manifestStorage });

// Manifest Endpoints
app.get('/api/manifests', (req, res) => {
    try {
        if (!fs.existsSync(manifestsDir)) return res.json({ items: [] });
        const files = fs.readdirSync(manifestsDir);
        const items = files.map(file => {
            const stats = fs.statSync(path.join(manifestsDir, file));
            return {
                fileName: file,
                uploadDate: stats.mtime,
                size: stats.size
            };
        }).sort((a, b) => b.uploadDate - a.uploadDate);
        res.json({ items });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/manifests/download/:filename', (req, res) => {
    const filePath = path.join(manifestsDir, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.download(filePath);
});

app.get('/api/manifests/view/:filename', (req, res) => {
    const filePath = path.join(manifestsDir, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(filePath);
});

app.post('/api/manifests/upload', uploadManifest.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const savedPath = path.resolve(req.file.path);
    if (fs.existsSync(savedPath)) {
        res.json({ success: true, fileName: req.file.filename, physicalPath: savedPath });
    } else {
        res.status(500).json({ error: 'File save verification failed' });
    }
});

app.get('/api/shipments/:id/assets', async (req, res) => {
    try {
        const { data, error } = await supabase.from('uploaded_files').select('*').eq('trackingId', req.params.id);
        if (error) throw error;
        res.json(data.map(r => ({ ...r, downloadURL: `/uploads/${r.assetType || 'documents'}/${r.fileName}` })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shipments/:id/assets', upload.single('file'), async (req, res) => {
    try {
        const id = req.params.id;
        const file = req.file;
        const assetType = req.body.type || (file.mimetype.startsWith('image/') ? 'images' : 'documents');
        const { error } = await supabase.from('uploaded_files').insert({
            trackingId: id,
            fileName: file.filename,
            filePath: file.path,
            fileType: file.mimetype,
            fileSize: file.size,
            assetType: assetType
        });
        if (error) throw error;
        res.json({ success: true, fileName: file.filename });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/shipments/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('shipments').delete().eq('trackingId', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Finance
app.get('/api/transactions', async (req, res) => {
    try {
        const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false }).order('updated_at', { ascending: false });
        if (error) throw error;
        res.json({ items: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/transactions', async (req, res) => {
    try {
        const d = req.body;
        const id = d.id || `TXN-${Date.now()}`;

        const { data: existing } = await supabase.from('transactions').select('created_at').eq('id', id).maybeSingle();

        const txnData = {
            id,
            type: d.type,
            category: d.category,
            description: d.description,
            amount: parseFloat(d.amount) || 0,
            date: d.date,
            paymentMethod: d.paymentMethod,
            status: d.status || 'Paid',
            shipmentRef: d.shipmentRef || '',
            updated_at: new Date().toISOString(),
            created_at: existing ? existing.created_at : new Date().toISOString()
        };

        const { error } = await supabase.from('transactions').upsert(txnData, { onConflict: 'id' });
        if (error) throw error;

        res.json({ success: true, id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/transactions/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('transactions').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Audit Logs
app.get('/api/audit-logs', async (req, res) => {
    try {
        const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500);
        if (error) throw error;
        res.json({ items: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Notifications
app.get('/api/notifications', async (req, res) => {
    try {
        const { uid } = req.query;
        let query = supabase.from('notifications').select('*');
        if (uid) query = query.eq('recipientUid', uid);
        const { data, error } = await query.order('createdAt', { ascending: false }).limit(100);
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/notifications', async (req, res) => {
    try {
        const { uid } = req.query;
        let query = supabase.from('notifications').delete();
        if (uid) query = query.eq('recipientUid', uid);
        else query = query.neq('id', 0); // Safety fallback if no uid, though risky

        const { error } = await query;
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Settings
app.get('/api/settings/:category', async (req, res) => {
    try {
        const { data, error } = await supabase.from('settings').select('*').eq('category', req.params.category);
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings/:category', async (req, res) => {
    try {
        const { settings } = req.body;
        const category = req.params.category;
        for (const [key, value] of Object.entries(settings)) {
            const { error } = await supabase.from('settings').upsert({
                category,
                setting_key: key,
                setting_value: String(value),
                updated_at: new Date().toISOString()
            }, { onConflict: 'category,setting_key' });

            if (error) {
                console.error(`[Settings] Error upserting ${key}:`, error);
                throw error;
            }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Users
app.get('/api/users/profile/:email', async (req, res) => {
    try {
        const { data, error } = await supabase.from('users').select('*').eq('email', req.params.email).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: "User not found" });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users', async (req, res) => {
    try {
        const { data, error } = await supabase.from('users').select('id, email, role, branchCode, status');
        if (error) throw error;
        res.json(data.map(r => ({ ...r, uid: String(r.id) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', async (req, res) => {
    try {
        const d = req.body;
        const userData = {
            displayName: d.displayName || '',
            email: d.email,
            password: d.password,
            role: d.role || 'employee',
            branchCode: d.branchCode || '',
            status: d.status || 'enabled',
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString()
        };
        const { error } = await supabase.from('users').upsert(userData, { onConflict: 'email' });
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('users').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(port, '0.0.0.0', () => { console.log(`Server running on port ${port} (Supabase mode)`); });
