const { createClient } = require("@supabase/supabase-js");

const mockUrl = "https://example.supabase.co";
const mockKey = "some-key";

try {
    const supabase = createClient(mockUrl, mockKey);
    console.log("Client created successfully with mock data.");
    console.log("Supabase exists:", !!supabase);
} catch (e) {
    console.error("Failed to create client:", e.message);
}
