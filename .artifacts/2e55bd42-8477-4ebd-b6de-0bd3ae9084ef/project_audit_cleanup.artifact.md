# Noorani Cargo Project Audit & Cleanup Report

## Audit Summary
A comprehensive A-to-Z audit was performed on the Noorani Cargo Tracking project. The system has successfully migrated to a **Supabase (PostgreSQL)** backend, rendering local **SQLite** databases and related initialization scripts obsolete.

### 1. KEEP (Required for Production)
These items are essential for the current working system, including the 104 shipment records, Admin system, Public Tracking, and Supabase integration.

- **Frontends**:
    - [hosting-admin/](file:///C:/noorani-cargo-tracking/hosting-admin/) (Admin Management System)
    - [hosting-tracking/](file:///C:/noorani-cargo-tracking/hosting-tracking/) (Public Tracking Portal)
- **Backend**:
    - [server/index.js](file:///C:/noorani-cargo-tracking/server/index.js) (Express API Server)
    - [server/package.json](file:///C:/noorani-cargo-tracking/server/package.json) (Core dependencies)
- **Data & Configuration**:
    - [master_shipments.json](file:///C:/noorani-cargo-tracking/master_shipments.json) (Source of truth for 104 records)
    - [supabase_schema.sql](file:///C:/noorani-cargo-tracking/supabase_schema.sql) (Database documentation)
    - [data/manifests/](file:///C:/noorani-cargo-tracking/data/manifests/) (Physical file storage)
    - [data/uploads/](file:///C:/noorani-cargo-tracking/data/uploads/) (Physical file storage)
    - [firebase.json](file:///C:/noorani-cargo-tracking/firebase.json), [.firebaserc](file:///C:/noorani-cargo-tracking/.firebaserc) (Hosting configurations)
    - [package.json](file:///C:/noorani-cargo-tracking/package.json), [.gitignore](file:///C:/noorani-cargo-tracking/.gitignore)

### 2. DELETE (Confirmed Unnecessary)
These items are redundant, obsolete, or abandoned references.

- **Obsolete Databases**:
    - `data/noorani-cargo.db` (Legacy SQLite database)
    - `data/noorani-cargo-backup.db` (Legacy SQLite backup)
    - `data_backups/noorani-cargo-local-premerge.db` (Legacy SQLite pre-merge)
- **Unused Structures**:
    - `data/database/` (Empty directory)
- **Abandoned References**:
    - `server/package.json`: script `"init-db": "node init-db.js"` (File does not exist)

### 3. ARCHIVE (Backup/Reference)
Useful for historical context but not required for daily operations.

- `rescue_data.json` (Redundant copy of shipment records)
- `server/migrate_data.js` (Migration script, keep for reference)

### 4. REQUIRES CONFIRMATION
- **NONE**: All items have been clearly identified as part of the legacy SQLite system or the active Supabase system.

---

## Cleanup Execution Plan
1. Update [server/package.json](file:///C:/noorani-cargo-tracking/server/package.json) to remove abandoned `init-db` script and update description.
2. Remove obsolete `.db` files and empty `data/database/` directory.
3. Move `rescue_data.json` and `migrate_data.js` to an `archives/` folder.
