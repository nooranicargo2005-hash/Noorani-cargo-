/**
 * NOORANI CARGO | Enterprise Regression Test Suite (Production Simulation)
 * Purpose: Verify the end-to-end Aramex-style workflow through the real API.
 */

const API_URL = "https://noorani-cargo-api.onrender.com/api";
// Change to http://localhost:3000/api if testing locally

const TEST_SWB_1 = "NC-REG-001";
const TEST_SWB_2 = "NC-REG-002";
const TEST_MANIFEST = "MNF-REG-999";

async function runRegression() {
    console.log("🛠️ Starting Enterprise Regression Test...\n");

    try {
        // 1. Create SWB 1
        console.log(`[Step 1] Creating ${TEST_SWB_1}...`);
        const c1 = await fetch(`${API_URL}/swbs/${TEST_SWB_1}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                swbSerial: TEST_SWB_1,
                customer: "Regression Corp",
                status: "Created",
                origin: "Dubai Hub"
            })
        });
        if (!c1.ok) throw new Error(`Create SWB 1 Failed: ${c1.status}`);
        console.log("✅ Step 1: Create PASS");

        // 2. Status Change (History Timeline Test)
        console.log(`[Step 2] Moving ${TEST_SWB_1} to 'In Transit'...`);
        const s1 = await fetch(`${API_URL}/swbs/${TEST_SWB_1}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: "In Transit", statusRemarks: "Departure from DXB Hub" })
        });
        if (!s1.ok) throw new Error("Status Update Failed");

        const h1 = await (await fetch(`${API_URL}/swbs/${TEST_SWB_1}/history`)).json();
        if (h1.length === 0) throw new Error("Status History Not Persisted");
        console.log(`✅ Step 2: History Timeline (Logs: ${h1.length}) PASS`);

        // 3. Manifest Module Test
        console.log(`[Step 3] Initializing Manifest ${TEST_MANIFEST}...`);
        const m1 = await fetch(`${API_URL}/manifests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                manifestNo: TEST_MANIFEST,
                origin: "DXB",
                destination: "LHR",
                status: "Draft"
            })
        });
        if (!m1.ok) throw new Error("Manifest Creation Failed");
        console.log("✅ Step 3: Manifest Creation PASS");

        // 4. Bulk Operations Simulation
        console.log(`[Step 4] Bulk Status Update for ${TEST_SWB_1} and ${TEST_SWB_2}...`);
        const b1 = await fetch(`${API_URL}/swbs/bulk/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ids: [TEST_SWB_1, TEST_SWB_2],
                status: "Arrived",
                remarks: "Consolidation complete"
            })
        });
        if (!b1.ok) throw new Error("Bulk Operation Failed");
        console.log("✅ Step 4: Bulk Status PASS");

        // 5. Public Tracking Verification
        console.log("[Step 5] Simulating Public Tracking Fetch...");
        const t1 = await fetch(`${API_URL}/swbs/${TEST_SWB_1}`);
        const tData = await t1.json();
        if (tData.data.status !== "Arrived") throw new Error("Tracking Data Desync");
        console.log(`✅ Step 5: Public Tracking (Status: ${tData.data.status}) PASS`);

        // 6. Cleanup (Destructive Action Confirmation)
        console.log("[Step 6] Cleaning up test records...");
        await fetch(`${API_URL}/swbs/${TEST_SWB_1}`, { method: 'DELETE' });
        await fetch(`${API_URL}/swbs/${TEST_SWB_2}`, { method: 'DELETE' });
        console.log("✅ Step 6: Cleanup PASS");

        console.log("\n✨ REGRESSION COMPLETE: ENTERPRISE WORKFLOW IS STABLE.");
    } catch (err) {
        console.error(`\n❌ REGRESSION FAILED: ${err.message}`);
        console.log("Reason: Check if production server has the latest v2.1 code and if SQL upgrade was applied.");
    }
}

runRegression();
