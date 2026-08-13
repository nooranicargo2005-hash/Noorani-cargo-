require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors({
    origin: '*',
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));

const apiRouter = express.Router();

// Dashboard Stats
apiRouter.get('/stats/dashboard', async (req, res) => {
    try {
        const { count, error } = await supabase.from('swbs').select('*', { count: 'exact', head: true });
        const { data: statusCounts } = await supabase.rpc('get_status_counts');
        let breakdown = {};
        (statusCounts || []).forEach(row => breakdown[row.status] = row.count);
        const { data: recent } = await supabase.from('swbs').select('*').order('created_at', { ascending: false }).limit(10);
        res.json({ totalSwbs: count || 0, breakdown, recentItems: recent || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// SWB Endpoints
apiRouter.get('/swbs', async (req, res) => {
    try {
        const { search, status, origin, destination, manifestNo, limit = 1000 } = req.query;
        let query = supabase.from('swbs').select('*');
        if (search) query = query.or(`"swbSerial".ilike.%${search}%,"customer".ilike.%${search}%,"consigneeName".ilike.%${search}%`);
        if (status) query = query.eq('status', status);
        if (origin) query = query.ilike('origin', `%${origin}%`);
        if (destination) query = query.ilike('destination', `%${destination}%`);
        if (manifestNo) query = query.eq('manifestNo', manifestNo);
        const { data, error } = await query.order('created_at', { ascending: false }).limit(parseInt(limit));
        if (error) throw error;
        res.json({ items: data || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.get('/swbs/:id', async (req, res) => {
    try {
        const { data, error } = await supabase.from('swbs').select('*').eq('swbSerial', req.params.id).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Not Found" });
        res.json({ data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/swbs/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('swbs').upsert({ ...req.body, swbSerial: req.params.id, updated_at: new Date().toISOString() }, { onConflict: 'swbSerial' });
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.delete('/swbs/:id', async (req, res) => {
    try {
        const { error } = await supabase.from('swbs').delete().eq('swbSerial', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Manifests
apiRouter.get('/manifests', async (req, res) => {
    try {
        const { data, error } = await supabase.from('manifests').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data || []);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

apiRouter.post('/manifests', async (req, res) => {
    try {
        const { error } = await supabase.from('manifests').upsert(req.body, { onConflict: 'manifestNo' });
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use('/api', apiRouter);

// NOORANI ENTERPRISE ENGINE | Version 2.6 (Sub-folder fallback)
app.get('/', (req, res) => res.json({
    system: "NOORANI CARGO ENTERPRISE",
    version: "2.6-fallback",
    status: "online"
}));

app.listen(port, '0.0.0.0', () => {
    console.log(`[System] NOORANI Server Running on Port ${port}`);
});
