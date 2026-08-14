/**
 * Test the actual Noorani Cargo API in index.js
 */

const { spawn } = require('child_process');

async function runTests() {
    console.log('--- Starting Actual API Test ---');

    // Start the server
    const serverProcess = spawn('node', ['C:/noorani-cargo-tracking/index.js'], {
        env: { ...process.env, PORT: '10005', SUPABASE_URL: 'https://dummy.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'dummy' }
    });

    serverProcess.stdout.on('data', (data) => console.log(`[Server] ${data}`));
    serverProcess.stderr.on('data', (data) => console.error(`[Server Error] ${data}`));

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    const tests = [
        'http://localhost:10005/api/health',
        'http://localhost:10005/api/shipments',
        'http://localhost:10005/api/shipments?limit=1000',
        'http://localhost:10005/api/stats/dashboard'
    ];

    for (const url of tests) {
        try {
            const res = await fetch(url);
            const body = await res.json();
            console.log(`[TEST] GET ${url} -> Status: ${res.status}`, body);
        } catch (e) {
            console.error(`[TEST] GET ${url} -> FAILED`, e.message);
        }
    }

    serverProcess.kill();
    console.log('--- Test Complete ---');
}

runTests();
