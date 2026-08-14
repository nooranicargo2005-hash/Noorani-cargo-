/**
 * Local API Debugger
 * This script starts the backend and performs a series of internal requests
 * to verify route matching and path resolution.
 */

const express = require('express');
const fetch = require('node-fetch'); // Assuming it's available or we use dynamic import

// We will simulate the app logic here to verify routing without external dependencies
const app = express();
const api = express.Router();

api.get('/shipments', (req, res) => res.json({ success: true, route: '/api/shipments' }));
api.get('/shipments/:serial', (req, res) => res.json({ success: true, route: '/api/shipments/:serial', serial: req.params.serial }));

api.use((req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found', path: req.baseUrl + req.path });
});

app.use('/api', api);
app.get('/', (req, res) => res.json({ success: true, root: true }));

const server = app.listen(10001, async () => {
    console.log('Test Server running on 10001');

    const tests = [
        'http://localhost:10001/',
        'http://localhost:10001/api/shipments',
        'http://localhost:10001/api/shipments/TEST123',
        'http://localhost:10001/api/notfound'
    ];

    for (const url of tests) {
        try {
            const res = await fetch(url);
            const body = await res.json();
            console.log(`[GET] ${url} -> Status: ${res.status}`, body);
        } catch (e) {
            console.error(`[GET] ${url} -> FAILED`, e.message);
        }
    }

    server.close();
});
