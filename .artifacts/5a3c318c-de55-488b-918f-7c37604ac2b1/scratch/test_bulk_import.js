/**
 * Test Bulk Import API
 */

async function testBulkImport() {
    const url = 'http://localhost:10005/api/shipments/bulk/import';
    const payload = {
        items: [
            { swbSerial: 'IMPORT-TEST-001', customer: 'Test Corp', origQty: 5, status: 'Created' },
            { swbSerial: 'IMPORT-TEST-002', customer: 'Sample Inc', origQty: 2, status: 'In Transit' }
        ]
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const body = await res.json();
        console.log('[TEST] Bulk Import Result:', body);
        if (body.success && body.count === 2) {
            console.log('--- TEST PASSED ---');
        } else {
            console.error('--- TEST FAILED ---', body);
        }
    } catch (e) {
        console.error('[TEST] ERROR:', e.message);
    }
}

// Start the server first (simulated in test_actual_api.js style)
const { spawn } = require('child_process');
const serverProcess = spawn('node', ['C:/noorani-cargo-tracking/index.js'], {
    env: { ...process.env, PORT: '10005', SUPABASE_URL: 'https://dummy.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'dummy' }
});

serverProcess.stdout.on('data', (data) => {
    console.log(`[Server] ${data}`);
    if (data.toString().includes('Running on port')) {
        setTimeout(() => {
            testBulkImport().then(() => serverProcess.kill());
        }, 1000);
    }
});
