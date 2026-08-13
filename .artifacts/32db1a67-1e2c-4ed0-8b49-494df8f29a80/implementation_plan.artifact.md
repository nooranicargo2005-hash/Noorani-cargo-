# Fix Excel Import Flow & Database Connectivity

The goal is to fix the entire flow from Excel file selection to display in the "All Shipments" inventory, resolving the "Database configuration is missing" error and ensuring data integrity.

## User Review Required

> [!IMPORTANT]
> The error "Database configuration is missing" indicates that the backend is not connected to Supabase. This typically requires setting `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment (e.g., Render dashboard or a `.env` file). I will update the code to handle missing configuration more gracefully and ensure all fields are correctly mapped and saved.

## Proposed Changes

### Backend (Node.js)

#### [MODIFY] [index.js](file:///C:/noorani-cargo-tracking/index.js)
- Enhance `/api/swbs/:serial` POST route to enforce data types (`parseInt` for `origQty`, `parseFloat` for `origWt`).
- Ensure all fields from the Aramex-style manifest are supported and correctly saved to Supabase.
- Add better logging for Supabase connection failures.

### Frontend (Admin)

#### [MODIFY] [enterprise-admin.js](file:///C:/noorani-cargo-tracking/hosting-admin/enterprise-admin.js)
- **Refine `handleFileImport`**:
    - Improve header detection to be case-insensitive and handle more variations (e.g., "AWB #", "Qty (pcs)").
    - Add robust date parsing to handle different Excel date formats.
    - Ensure `origQty` and `origWt` are always valid numbers before sending to the API.
- **Optimize `executeImport`**:
    - Await `loadDashboard` and `refreshDashboard` to ensure the UI updates only after the backend is ready.
    - Add a "Mission Successful" visual confirmation that doesn't just rely on an alert.

#### [MODIFY] [firebase.js](file:///C:/noorani-cargo-tracking/hosting-admin/firebase.js)
- Fix the `API_BASE` detection to ensure it consistently targets the correct backend port (10000 for root `index.js` or 3000 for `server/index.js`).

## Verification Plan

### Automated Tests
- I will use a scratch script to simulate the Excel parsing logic with various header sets to confirm mapping accuracy.
- I will simulate an import API call to verify the backend's data handling.

### Manual Verification
- The user should verify by:
    1. Uploading a test Excel file.
    2. Checking the "Mapped" and "Unmapped" preview sections.
    3. Clicking "PROCESS PERMANENT IMPORT".
    4. Confirming that the records appear in the "SWB Inventory" table immediately.
