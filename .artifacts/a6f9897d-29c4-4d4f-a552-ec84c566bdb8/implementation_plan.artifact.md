# Implementation Plan — Noorani Cargo Professional SWB System

This plan transforms the current Noorani Cargo tracking system into a professional Sea Waybill (SWB) management platform with 11 core data fields, robust persistence, and a public tracking portal.

## User Review Required

> [!IMPORTANT]
> **Database Credentials**: For the system to be "online" and professional, you must provide your Supabase URL and Service Role Key. If you haven't set them up, I will provide instructions on how to do so. The current "API Unreachable" error is likely due to missing environment variables on the server.

> [!NOTE]
> **Field Duplication**: The requirements list both `Cust. Inv. No.` and `Customer Inv. No.`. I have kept both as separate fields in the database and UI to match your exact request.

## Proposed Changes

### 1. Database & Backend (Supabase + Node.js)
Ensure the database schema and server-side logic fully support the 11 fields and provide robust error handling.

#### [MODIFY] [supabase_schema.sql](file:///C:/noorani-cargo-tracking/supabase_schema.sql)
* Verify the 11 fields are correctly typed.
* Add an `origin` field or similar if needed for future expansion, but strictly keep the 11 fields visible to the user.

#### [MODIFY] [server/index.js](file:///C:/noorani-cargo-tracking/server/index.js)
* Optimize the `/api/swbs` endpoints to handle all 11 fields.
* Add a `/api/swbs/recent` endpoint for the dashboard.
* Enhance error logging to help diagnose connection issues.

---

### 2. Admin Portal (Management)
Upgrade the admin interface to handle manual entry, bulk import, and inventory management for the 11 fields.

#### [MODIFY] [hosting-admin/enterprise-admin.js](file:///C:/noorani-cargo-tracking/hosting-admin/enterprise-admin.js)
* **Register SWB**: Ensure the save logic correctly maps all 11 fields.
* **Excel Import**: Refine the column mapping logic to be more flexible and accurate for the 11 fields.
* **Inventory**: Update the table columns and edit modal to show all 11 fields.
* **Dashboard**: Implement the "Recent Records" list and ensure stats are accurate.

#### [MODIFY] [hosting-admin/firebase.js](file:///C:/noorani-cargo-tracking/hosting-admin/firebase.js)
* Improve `apiFetch` to provide more descriptive error messages when the server is unreachable.
* Add logic to detect if the server is offline and suggest a local fallback or check for `.env` configuration.

---

### 3. Public Tracking (Customer Portal)
Provide a clean, secure way for customers to view their SWB details.

#### [MODIFY] [hosting-tracking/index.html](file:///C:/noorani-cargo-tracking/hosting-tracking/index.html)
* Update the results display to show all 11 fields in a professional layout.
* Ensure "SWB Not Found" message is clear and professional.

---

### 4. Branding & Design
Maintain the Noorani Cargo dark/yellow aesthetic throughout.

#### [MODIFY] [hosting-admin/core.css](file:///C:/noorani-cargo-tracking/hosting-admin/core.css)
* Polish the table styles for large data sets (horizontal scrolling for the 11 columns).
* Enhance the dashboard KPI cards.

## Verification Plan

### Automated Tests
* I will use `run_shell_command` to test the server endpoints locally if possible (mocking Supabase if needed).
* I will verify the Excel import logic with a sample CSV format.

### Manual Verification
* **Create SWB**: Manually enter data and check if it appears in the Inventory and Public Tracking.
* **Import Excel**: Upload a test file and verify mapping.
* **Edit/Delete**: Perform updates and verify database persistence.
* **Public Tracking**: Search for a known Serial No. and verify all 11 fields are displayed.
