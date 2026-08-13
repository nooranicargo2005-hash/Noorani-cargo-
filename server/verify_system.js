/**
 * NOORANI CARGO | System Verification Suite
 * This script simulates the frontend's interaction with the API to verify the end-to-end flow.
 */

const TEST_SWB = {
    swbSerial: "NC-TEST-999",
    custInvNo: "INV-101",
    swbDate: "13-08-2026",
    customer: "Global Logistics Ltd",
    customerInvNo: "CUST-999",
    shipperName: "Noorani Export House",
    consigneeName: "M.A. Trading Co",
    origQty: 50,
    origWt: 125.5,
    consigneeCity: "Dubai",
    consigneeAddress: "Al Quoz Industrial Area 3, Warehouse 4"
};

const API_URL = "http://localhost:3000/api";

async function runTests() {
    console.log("🚀 Starting Noorani Cargo Verification Suite...\n");

    try {
        // 1. Create SWB
        console.log("[Test 1] Creating SWB...");
        const createRes = await fetch(`${API_URL}/swbs/${TEST_SWB.swbSerial}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_SWB)
        });
        if (!createRes.ok) throw new Error("Create Failed");
        console.log("✅ Create SWB: PASS");

        // 2. Read / Persistence
        console.log("[Test 2] Verifying Persistence...");
        const readRes = await fetch(`${API_URL}/swbs/${TEST_SWB.swbSerial}`);
        const readData = await readRes.json();
        if (readData.data.customer !== TEST_SWB.customer) throw new Error("Data Mismatch");
        console.log("✅ Persistence & Read: PASS");

        // 3. Edit / Update
        console.log("[Test 3] Updating Record...");
        const updateData = { ...TEST_SWB, consigneeCity: "Abu Dhabi" };
        await fetch(`${API_URL}/swbs/${TEST_SWB.swbSerial}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        const verifyUpdate = await (await fetch(`${API_URL}/swbs/${TEST_SWB.swbSerial}`)).json();
        if (verifyUpdate.data.consigneeCity !== "Abu Dhabi") throw new Error("Update Failed");
        console.log("✅ Edit & Update: PASS");

        // 4. Search
        console.log("[Test 4] Testing Multi-Column Search...");
        const searchRes = await fetch(`${API_URL}/swbs?search=Abu+Dhabi`);
        const searchItems = (await searchRes.json()).items;
        if (!searchItems.some(i => i.swbSerial === TEST_SWB.swbSerial)) throw new Error("Search Failed");
        console.log("✅ Search/Filter: PASS");

        // 5. Dashboard Stats
        console.log("[Test 5] Verifying Dashboard Stats...");
        const statsRes = await fetch(`${API_URL}/stats/dashboard`);
        const stats = await statsRes.json();
        if (stats.totalSwbs === 0) throw new Error("Stats Reporting 0");
        console.log(`✅ Dashboard Stats (Total: ${stats.totalSwbs}): PASS`);

        // 6. Public Tracking
        console.log("[Test 6] Verifying Public Tracking Endpoint...");
        const trackRes = await fetch(`${API_URL}/swbs/${TEST_SWB.swbSerial}`);
        if (!trackRes.ok) throw new Error("Tracking 404");
        console.log("✅ Public Tracking API: PASS");

        // 7. Delete
        console.log("[Test 7] Deleting Record...");
        await fetch(`${API_URL}/swbs/${TEST_SWB.swbSerial}`, { method: 'DELETE' });
        const finalCheck = await fetch(`${API_URL}/swbs/${TEST_SWB.swbSerial}`);
        if (finalCheck.status !== 404) throw new Error("Delete Failed");
        console.log("✅ Delete & Cleanup: PASS");

        console.log("\n✨ ALL BACKEND TESTS PASSED!");
    } catch (err) {
        console.error(`\n❌ TEST FAILED: ${err.message}`);
        console.log("Note: Ensure local server is running with 'npm start' before verifying.");
    }
}

runTests();
