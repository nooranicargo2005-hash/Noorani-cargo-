const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', 'server', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env');
    process.exit(1);
}

const DATA_FILE = path.resolve(__dirname, '..', 'master_shipments.json');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
    console.log('🚀 Initializing NOORANI CARGO Safety Migration...');

    try {
        // 1. Locate and load the verified master dataset
        if (!fs.existsSync(DATA_FILE)) {
            throw new Error(`CRITICAL: Master dataset not found at ${DATA_FILE}`);
        }

        const rawData = fs.readFileSync(DATA_FILE, 'utf8');
        const shipments = JSON.parse(rawData);

        // 2. Pre-Migration Verification: Exact Count Requirement
        const EXPECTED_COUNT = 104;
        if (shipments.length !== EXPECTED_COUNT) {
            throw new Error(`ABORT: Dataset contains ${shipments.length} records. Expected exactly ${EXPECTED_COUNT}.`);
        }

        // 3. Pre-Migration Verification: Uniqueness and Integrity
        const trackingIds = shipments.map(s => s.trackingId);
        const uniqueIds = new Set(trackingIds);

        if (trackingIds.some(id => !id)) {
            throw new Error(`ABORT: Data Integrity Failure. One or more records are missing a trackingId.`);
        }

        if (uniqueIds.size !== EXPECTED_COUNT) {
            throw new Error(`ABORT: Data Integrity Failure. Duplicate trackingIds found in local dataset.`);
        }

        console.log(`📦 Pre-Flight Pass: ${shipments.length} unique records verified.`);

        // 4. Perform Atomic Upsert to Supabase
        // Upserts all 35 fields (including driver and vehicle) using trackingId as the conflict key.
        // This will NOT delete any existing records in Supabase.
        console.log('📡 Syncing with Supabase PostgreSQL...');
        const { error } = await supabase
            .from('shipments')
            .upsert(shipments, { onConflict: 'trackingId' });

        if (error) throw error;

        // 5. Post-Migration Verification: Full ID Audit
        console.log('🔍 Performing full cloud synchronization audit...');

        const { data: cloudData, error: auditError } = await supabase
            .from('shipments')
            .select('trackingId');

        if (auditError) throw auditError;

        const cloudIds = new Set(cloudData.map(c => c.trackingId));
        const missingIds = trackingIds.filter(id => !cloudIds.has(id));

        if (missingIds.length > 0) {
            throw new Error(`CRITICAL: Sync Mismatch! ${missingIds.length} records are missing from Supabase: ${missingIds.join(', ')}`);
        }

        console.log(`✅ SUCCESS: All ${shipments.length} specific records verified in Supabase!`);
        console.log(`🔗 Total shipments currently in cloud: ${cloudData.length}`);

    } catch (err) {
        console.error('❌ MIGRATION ABORTED:');
        console.error(`Name: ${err.name}`);
        console.error(`Message: ${err.message}`);
        if (err.cause) {
            console.error('Cause:', err.cause);
        }
        process.exit(1);
    }
}

runMigration();
