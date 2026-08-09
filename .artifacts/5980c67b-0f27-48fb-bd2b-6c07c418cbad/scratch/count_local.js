const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = 'C:/noorani-cargo-tracking/data/noorani-cargo.db';

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to local DB:', err.message);
        process.exit(1);
    }
    db.get("SELECT COUNT(*) as c FROM shipments", (err, row) => {
        if (err) {
            console.error('Error querying local DB:', err.message);
        } else {
            console.log('Local Shipment Count:', row.c);
        }
        db.close();
    });
});
