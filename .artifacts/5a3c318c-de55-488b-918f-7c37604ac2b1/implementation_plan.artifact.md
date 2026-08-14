# Noorani Cargo Project Consolidation & Cleanup Plan

This plan aims to streamline the Noorani Cargo tracking system by consolidating duplicate features, cleaning up obsolete code, and ensuring a consistent integration between the frontend, API, and Supabase/Firebase.

## User Review Required

> [!IMPORTANT]
> **Database Table Consolidation**: I will standardize on the `shipments` table name. The `swbs` table references will be migrated and removed to avoid confusion.
> **Auth & User Management**: The system currently uses Firebase for Authentication but Supabase for data. I will ensure the `users` table in Supabase remains synchronized with Firebase Auth for role-based access control.

## Proposed Changes

### Database & Backend

#### [MODIFY] [index.js](file:///C:/noorani-cargo-tracking/index.js)
- Remove redundant table detection logic (preferring `shipments`).
- Standardize all endpoints to use `/api/shipments`.
- Add comprehensive JSDoc comments to all routes and utility functions.
- Fix any broken database connection logic.

#### [NEW] [supabase_init.sql](file:///C:/noorani-cargo-tracking/supabase_init.sql)
- Consolidate `supabase_schema.sql`, `supabase_upgrade.sql`, and `supabase_rpc.sql` into a single, clean initialization script.
- Rename the `swbs` table to `shipments`.

#### [DELETE] [supabase_schema.sql](file:///C:/noorani-cargo-tracking/supabase_schema.sql)
#### [DELETE] [supabase_upgrade.sql](file:///C:/noorani-cargo-tracking/supabase_upgrade.sql)
#### [DELETE] [supabase_rpc.sql](file:///C:/noorani-cargo-tracking/supabase_rpc.sql)

---

### Frontend (Admin)

#### [MODIFY] [firebase.js](file:///C:/noorani-cargo-tracking/hosting-admin/firebase.js)
- Rename SWB-related functions to Shipment-related (e.g., `saveShipment`, `queryShipments`).
- Update API calls to point exclusively to `/api/shipments`.

#### [MODIFY] [enterprise-admin.js](file:///C:/noorani-cargo-tracking/hosting-admin/enterprise-admin.js)
- Update function calls to match the new `firebase.js` names.
- Clean up the import logic and add comments.
- Ensure all "Noorani Cargo" branding is consistently applied.

#### [MODIFY] [admin-multipage.js](file:///C:/noorani-cargo-tracking/hosting-admin/admin-multipage.js)
- Add comments describing the shell and routing logic.
- Clean up any redundant DOM manipulation.

---

### Frontend (Tracking)

#### [MODIFY] [index.html](file:///C:/noorani-cargo-tracking/hosting-tracking/index.html)
- Ensure consistent "Noorani Cargo" branding and connection to the consolidated API.

---

### Branding & Cleanup

#### [MODIFY] [package.json](file:///C:/noorani-cargo-tracking/package.json)
- Update project description and scripts for clarity.

#### [DELETE] Confirmed unused files
- I will scan for and remove any other files that are not referenced in the project.

## Verification Plan

### Automated Tests
- I will create a scratch script to test all API endpoints:
  - `GET /api/health`
  - `GET /api/shipments`
  - `POST /api/shipments/:serial`
  - `DELETE /api/shipments/:serial`
  - `GET /api/stats/dashboard`
  - `GET /api/manifests`

### Manual Verification
1. **Admin Login**: Verify Firebase Auth works and redirects to the dashboard.
2. **Dashboard**: Check if stats are correctly pulled from Supabase.
3. **Register SWB**: Create a new shipment and verify it appears in the list.
4. **Excel/PDF Import**: Test the unified import system with sample files.
5. **Shipment Lifecycle**: Update status, verify history, and test tracking.
6. **Manifests**: Create and view manifests.
7. **Search/Filter**: Test global search and status filtering.
8. **Export**: Verify Excel export functionality.
