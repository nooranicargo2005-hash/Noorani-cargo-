const REMOTE_URL = "https://noorani-cargo-api.onrender.com";

async function test() {
    console.log("Testing Remote API: " + REMOTE_URL);

    const endpoints = [
        "/",
        "/api/stats/dashboard",
        "/api/swbs",
        "/api/manifests",
        "/stats/dashboard",
        "/swbs"
    ];

    for (const e of endpoints) {
        try {
            const res = await fetch(REMOTE_URL + e);
            console.log(`[${res.status}] ${e}`);
            if (res.ok) {
                const data = await res.text();
                console.log("   Content: " + data.substring(0, 100));
            }
        } catch (err) {
            console.log(`[ERR] ${e}: ${err.message}`);
        }
    }
}

test();
