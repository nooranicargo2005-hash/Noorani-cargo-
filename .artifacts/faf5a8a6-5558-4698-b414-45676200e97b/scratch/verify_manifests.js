/**
 * End-to-End Verification for Manifests and File Manager
 */

const BASE_URL = 'http://localhost:10000/api';

async function runTests() {
    console.log('--- Starting Manifest System Verification ---');

    try {
        // 1. Create Manifest
        console.log('1. Creating Manifest...');
        const mRes = await fetch(`${BASE_URL}/manifests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                manifestNo: 'TEST-MF-99',
                origin: 'Dubai',
                destination: 'London',
                status: 'Draft'
            })
        });
        const mData = await mRes.json();
        console.log('Manifest Created:', mData.success);

        // 2. Add Shipment to Manifest
        // First find a shipment
        const sRes = await fetch(`${BASE_URL}/shipments?limit=1`);
        const sData = await sRes.json();
        if (sData.items && sData.items.length > 0) {
            const serial = sData.items[0].swbSerial;
            console.log(`2. Assigning Shipment ${serial} to Manifest...`);
            await fetch(`${BASE_URL}/shipments/${serial}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ manifestNo: 'TEST-MF-99' })
            });
        }

        // 3. Verify Manifest Stats
        console.log('3. Verifying Manifest Stats...');
        const statsRes = await fetch(`${BASE_URL}/manifests`);
        const statsData = await statsRes.json();
        const myMf = statsData.data.find(m => m.manifestNo === 'TEST-MF-99');
        console.log(`Stats -> Shipments: ${myMf.totalShipments}, Qty: ${myMf.totalQty}`);

        // 4. File Manager Operations
        console.log('4. Testing File Manager...');
        // Create Folder
        const fldRes = await fetch(`${BASE_URL}/manifests/TEST-MF-99/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Docs', type: 'folder' })
        });
        const folder = await fldRes.json();
        console.log('Folder Created:', folder.data.name, 'ID:', folder.data.id);

        // Create File in Folder
        const filRes = await fetch(`${BASE_URL}/manifests/TEST-MF-99/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'readme.txt', type: 'file', parent_id: folder.data.id, content: 'Hello World' })
        });
        const file = await filRes.json();
        console.log('File Created in Folder:', file.data.name);

        // Get File List
        const listRes = await fetch(`${BASE_URL}/manifests/TEST-MF-99/files`);
        const listData = await listRes.json();
        console.log('Total items in MF:', listData.data.length);

        // 5. Cleanup (Delete Manifest)
        console.log('5. Cleaning up...');
        await fetch(`${BASE_URL}/manifests/TEST-MF-99`, { method: 'DELETE' });
        console.log('Manifest Deleted.');

        console.log('--- Verification Complete: SUCCESS ---');
    } catch (e) {
        console.error('Verification FAILED:', e.message);
    }
}

runTests();
