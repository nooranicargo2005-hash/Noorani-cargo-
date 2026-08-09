# Fix Import Data Feature for Custom Excel Structure

Correct the `document-import.js` logic to handle Excel files where metadata is above headers, headers are on rows 13-14, and each shipment record spans two rows.

## User Review Required

> [!IMPORTANT]
> The implementation assumes that the "Date" and "Shipping No" at the top of the Excel sheet should be applied to every shipment imported from that file. If there are shipment-specific dates, they will be used as a fallback or override if found in the data rows.

## Proposed Changes

### hosting-admin

#### [MODIFY] [document-import.js](file:///C:/noorani-cargo-tracking/hosting-admin/document-import.js)
- Update `processFile` to read raw rows (`header: 1`).
- Extract `masterDate` and `masterShippingNo` from the first 12 rows.
- Implement a robust multi-row parser that:
  - Scans row 13 for header mapping.
  - Processes data rows starting from row 15 in pairs.
  - Combines Row 1 (details) and Row 2 (Qty/Weight) into a single record.
  - Maps fields correctly to database columns.

## Verification Plan

### Automated Tests
- Not applicable for this project as it lacks a JS test suite.

### Manual Verification
- Upload the specific Excel file provided by the user (or a mock one following the described structure).
- Verify that the "Data Preview" shows the combined records correctly.
- Verify that "Date" and "Shipping No" are correctly populated from the header area.
- Verify that clicking "Import Shipments" adds them to the system without errors.
