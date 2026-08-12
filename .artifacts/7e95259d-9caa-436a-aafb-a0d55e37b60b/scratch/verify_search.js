const axios = require('axios');

async function test(id) {
    try {
        const res = await axios.get(`https://noorani-cargo-api.onrender.com/api/shipments/${id}`);
        console.log(`ID ${id}: Found ${res.data.trackingId}`);
    } catch (e) {
        console.log(`ID ${id}: Error ${e.response ? e.response.status : e.message}`);
    }
}

async function run() {
    console.log('Verifying Search Identifiers in Production...');
    await test('NM-279'); // Tracking ID
    await test('12945'); // Customer Invoice No.
    // I need valid SWB Serial and Cust Inv No to test the others
}

run();
