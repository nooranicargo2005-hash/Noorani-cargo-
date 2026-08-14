# Implementation Plan - Fully Dynamic Import System

Transform the import system to be fully dynamic, automatically detecting and mapping fields from any Excel or PDF manifest regardless of column names, order, or format.

## User Review Required

> [!IMPORTANT]
> **Dynamic Mapping Logic**: The system will use a keyword-based fuzzy matcher to identify columns. For example, "Recv Name", "Consignee", and "Receiver" will all intelligently map to `consigneeName`.
> **PDF Data Extraction**: PDF parsing is inherently less structured than Excel. I will implement a line-by-line pattern matcher to identify potential shipment records, but the accuracy may vary depending on the PDF's layout complexity.

## Proposed Changes

### 1. Frontend (Admin)
Enhance the import logic in `enterprise-admin.js` to be schema-aware and dynamic.

#### [MODIFY] [hosting-admin/enterprise-admin.js](file:///C:/noorani-cargo-tracking/hosting-admin/enterprise-admin.js)
- Implement `getDynamicMapping(headers)`: A utility that analyzes file headers and returns a map to database fields.
- Update `parseExcel`: Use the dynamic mapper instead of fixed keyword lists.
- Update `parsePDF`: Enhance the regex and line-analysis to capture more fields (Shipper, Consignee, City) if present in the text.
- Ensure the preview modal correctly reflects the dynamically mapped data.

### 2. Backend (API)
Ensure the API is robust to receiving "raw" mapped data.

#### [MODIFY] [index.js](file:///C:/noorani-cargo-tracking/index.js)
- Enhance `mapToTableSchema`: Ensure it handles all 20+ fields defined in the `shipments` table.
- Add better logging to identify which fields were successfully mapped during an import.

## Verification Plan

### Automated Tests
- I will create a test script that simulates various "messy" Excel headers and verifies that they map correctly to the expected database fields.

### Manual Verification
1. **Dynamic Excel Import**: Upload an Excel file with scrambled column names (e.g., "Tracking#" instead of "swbSerial") and verify all data imports correctly.
2. **Multi-Format Test**: Test with different manifest layouts (Aramex, DHL style) to ensure the fuzzy matcher handles them.
3. **Verify Dashboard**: Confirm that all imported records appear in the "All Shipments" inventory with correct field values.
