# Noorani Cargo Synchronization Fixes Plan

Perform a complete synchronization of the Noorani Cargo system by fixing field gaps, improving data persistence, and automating financial entries.

## User Review Required

> [!IMPORTANT]
> The Finance automation will create a transaction in the `transactions` table when a shipment is marked as "Paid" and has a `shippingCost`. This will be made idempotent using a `shipmentRef` check.

## Proposed Changes

### 1. Admin UI & Logic (`hosting-admin`)

#### [MODIFY] [index.html](file:///C:/noorani-cargo-tracking/hosting-admin/index.html)
- Add input fields for `senderPhone`, `receiverPhone`, `originCountry`, `destinationCountry`, and `shipmentType` (dropdown) to the Cargo Registration form.
- Add `originCountry` and `destinationCountry` to the Shipment Workspace.

#### [MODIFY] [enterprise-admin.js](file:///C:/noorani-cargo-tracking/hosting-admin/enterprise-admin.js)
- Update `saveShipment` to collect values from the new form fields.
- Update `findShipmentInForm` to populate the new fields when loading an existing record.
- Update `resetShipmentForm` to clear the new fields.
- Update `saveRow` and `saveWS` to ensure `statusDate` is sent correctly when status changes.
- Fix `openShipmentWorkspace` to display the new fields and ensure `originalQuantity`/`originalWeight` are correctly passed to the save logic.

#### [MODIFY] [document-import.js](file:///C:/noorani-cargo-tracking/hosting-admin/document-import.js)
- Update `KEYWORDS` in `parseAutonomousExcel` to recognize phone numbers and countries.
- Update the mapping logic to extract these fields from the spreadsheet.

---

### 2. Backend API (`server`)

#### [MODIFY] [index.js](file:///C:/noorani-cargo-tracking/server/index.js)
- **CORS:** Restrict allowed origins to the specific Firebase hosting domains and local development ports.
- **Shipment Save (`POST /api/shipments/:id`):**
    - Remove hardcoded `'Air Freight'` for `shipmentType`.
    - Ensure `statusDate` updates if the status in `req.body` differs from the existing record.
    - Implement idempotent finance automation: If `paymentStatus` is `'Paid'` and `shippingCost > 0`, create an income transaction if one doesn't already exist for that `trackingId`.
- **Fields:** Ensure all new fields are correctly merged and saved.

---

### 3. Public Tracking (`hosting-tracking`)

#### [MODIFY] [index.html](file:///C:/noorani-cargo-tracking/hosting-tracking/index.html)
- Display `originCountry` and `destinationCountry` in the "Network Routing" section.
- Ensure consistent display of quantity, weight, and invoice number using the standardized database fields.

## Verification Plan

### Manual Verification
1. **Admin Create:** Use the registration form to create a shipment with all new fields. Verify in DB.
2. **Excel Import:** Import a manifest with the new columns. Verify mapping in preview and final sync.
3. **Admin Edit:** Edit a shipment's status. Verify `statusDate` updates.
4. **Finance Automation:** Mark a shipment as "Paid" with a cost. Verify an income transaction appears in the Ledger.
5. **Public Tracking:** Search for the created shipment. Verify countries and other fields display correctly.
6. **Persistence:** Verify `originalQuantity` and `originalWeight` are NOT lost during edits.
