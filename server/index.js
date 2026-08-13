require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('[System] CRITICAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Enhanced CORS for local and production flexibility
const allowedOrigins = [
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5501',
    'http://localhost:5500',
    'http://localhost:5501',
    'http://localhost:3000',
    'https://noorani-cargo-admin-2005.web.app',
    'https://noorani-cargo-tracking-2005.web.app',
    'https://noorani-cargo-admin.firebaseapp.com',
    'https://noorani-cargo-tracking.firebaseapp.com'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.includes('web.app')) {
            callback(null, true);
        } else {
            console.warn('[CORS] Origin Blocked:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));

// --- API Routes ---

// --- API Router ---
const apiRouter = express.Router();

// Dashboard Stats
apiRouter.get('/stats/dashboard', async (req, res) => {
    try {
        const { count, error } = await supabase.from('swbs').select('*', { count: 'exact', head: true });
        if (error) throw error;

        const { data: recent, error: recentError } = await supabase
            .from('swbs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (recentError) throw recentError;

        res.json({
            totalSwbs: count || 0,
            recentItems: recent || []
        });
    } catch (err) {
        console.error('[API] Stats Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// SWB Endpoints
apiRouter.get('/swbs', async (req, res) => {
    try {
        const { search, limit = 500 } = req.query;
        let query = supabase.from('swbs').select('*');

        if (search && search.trim() !== '') {
            const s = search.trim();
            // Strictly search across Serial, Customer, Consignee, and City for the new system
            // Fix: Ensure %${s}% is used for correct interpolation
            query = query.or(`"swbSerial".ilike.%${s}%,"customer".ilike.%${s}%,"consigneeName".ilike.%${s}%,"consigneeCity".ilike.%${s}%`);
        }

        const { data, error } = await query.order('created_at', { ascending: false }).limit(parseInt(limit));
        if (error) throw error;
        res.json({ items: data || [] });
    } catch (err) {
        console.error('[API] Query Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

apiRouter.get('/swbs/:id', async (req, res) => {
    try {
        const { data, error } = await supabase.from('swbs')
            .select('*')
            .eq('swbSerial', req.params.id)
            .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: "SWB Record Not Found" });
        res.json({ data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/swbs/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const d = req.body;

        if (!id) return res.status(400).json({ error: "SWB Serial Number is required" });

        const swbData = {
            swbSerial: id,
            custInvNo: d.custInvNo || '',
            swbDate: d.swbDate || '',
            customer: d.customer || '',
            customerInvNo: d.customerInvNo || '',
            shipperName: d.shipperName || '',
            consigneeName: d.consigneeName || '',
            origQty: parseInt(d.origQty) || 0,
            origWt: parseFloat(d.origWt) || 0,
            consigneeCity: d.consigneeCity || '',
            consigneeAddress: d.consigneeAddress || '',
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('swbs').upsert(swbData, { onConflict: 'swbSerial' });
        if (error) {
            console.error('[Supabase Error]', error);
            throw error;
        }
        res.json({ success: true, id });
    } catch (err) {
        console.error('[API] Save Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

apiRouter.delete('/swbs/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('swbs').delete().eq('swbSerial', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// User Management
apiRouter.get('/users', async (req, res) => {
    try {
        const { data, error } = await supabase.from('users').select('id, email, role, status');
        if (error) throw error;
        res.json(data.map(r => ({ ...r, uid: String(r.id) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/users', async (req, res) => {
    try {
        const d = req.body;
        const userData = {
            displayName: d.displayName || d.email.split('@')[0],
            email: d.email,
            password: d.password,
            role: d.role || 'employee',
            status: 'enabled',
            updated_at: new Date().toISOString()
        };
        const { error } = await supabase.from('users').upsert(userData, { onConflict: 'email' });
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/users/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('users').delete().eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/users/profile/:email', async (req, res) => {
    try {
        const { data, error } = await supabase.from('users').select('*').eq('email', req.params.email).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: "User profile not found" });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mount Router
app.use('/api', apiRouter);

app.get('/', (req, res) => res.send('NOORANI CARGO SWB API v2 is online.'));


app.listen(port, '0.0.0.0', () => {
    console.log(`[System] NOORANI SWB Server Running on Port ${port}`);
});
