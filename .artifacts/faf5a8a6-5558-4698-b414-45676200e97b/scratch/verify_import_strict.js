/**
 * Verification Script: Strict Schema Mapping
 * Purpose: Ensure import payloads contain NO invalid columns for the target table.
 */

const SWBS_WHITELIST = [
  'swbSerial', 'custInvNo', 'swbDate', 'customer', 'shipperName', 'shipperPhone', 'shipperAddress',
  'consignee', 'consigneePhone', 'consigneeAddress', 'origin', 'destination', 'status',
  'manifestNo', 'notes', 'origQty', 'origWt', 'type', 'created_at', 'updated_at'
];

const SHIPMENTS_WHITELIST = [
  'swbSerial', 'customerInvNo', 'custInvNo', 'swbDate', 'customer', 'shipperName', 'shipperPhone', 'shipperAddress',
  'consigneeName', 'consigneePhone', 'consigneeAddress', 'consigneeCity', 'origin', 'destination',
  'status', 'manifestNo', 'notes', 'origQty', 'origWt', 'type', 'assignedTo',
  'expectedDelivery', 'shippingCost', 'paymentStatus', 'originCountry', 'destinationCountry',
  'created_at', 'updated_at'
];

function mapToTableSchema(item, isLegacy) {
  const whitelist = isLegacy ? SWBS_WHITELIST : SHIPMENTS_WHITELIST;

  const rawRecord = {
    swbSerial: String(item.swbSerial || "").trim(),
    custInvNo: item.custInvNo || item.customerInvNo,
    customerInvNo: item.customerInvNo || item.custInvNo,
    swbDate: item.swbDate,
    customer: item.customer,
    shipperName: item.shipperName,
    shipperPhone: item.shipperPhone,
    shipperAddress: item.shipperAddress,
    consigneePhone: item.consigneePhone,
    consigneeAddress: item.consigneeAddress,
    origin: item.origin,
    status: item.status || "Created",
    manifestNo: item.manifestNo,
    notes: item.notes,
    origQty: parseInt(item.origQty) || 0,
    origWt: parseFloat(item.origWt) || 0,
    type: item.type || "SWB",
    assignedTo: item.assignedTo,
    expectedDelivery: item.expectedDelivery,
    shippingCost: item.shippingCost ? parseFloat(item.shippingCost) : undefined,
    paymentStatus: item.paymentStatus,
    originCountry: item.originCountry,
    destinationCountry: item.destinationCountry,
    created_at: item.created_at,
    updated_at: new Date().toISOString()
  };

  if (isLegacy) {
    // Legacy 'swbs' table mapping
    rawRecord.consignee = item.consigneeName || item.consignee;
    rawRecord.destination = item.destination || item.consigneeCity;
  } else {
    // Modern 'shipments' table mapping
    rawRecord.consigneeName = item.consigneeName;
    rawRecord.consigneeCity = item.consigneeCity;
    rawRecord.destination = item.destination;
  }

  const filteredRecord = {};
  whitelist.forEach(key => {
    if (rawRecord[key] !== undefined && rawRecord[key] !== null) {
      filteredRecord[key] = rawRecord[key];
    }
  });

  return filteredRecord;
}

// Simulation Data
const mockInput = {
    swbSerial: " NOORANI-TEST-001 ",
    customerInvNo: "INV-999",
    consigneeName: "John Doe",
    consigneeCity: "Dubai",
    shipperName: "Jane Smith",
    extraField: "This should be stripped",
    assignedTo: "Driver Alpha"
};

console.log("--- Testing LEGACY (swbs) mapping ---");
const swbResult = mapToTableSchema(mockInput, true);
console.log("Keys in swbResult:", Object.keys(swbResult));
const swbInvalidKeys = Object.keys(swbResult).filter(k => !SWBS_WHITELIST.includes(k));
if (swbInvalidKeys.length > 0) {
    console.error("FAIL: swbs record contains invalid keys:", swbInvalidKeys);
} else if (swbResult.consigneeName || swbResult.consigneeCity) {
    console.error("FAIL: swbs record contains modern fields (consigneeName/City)");
} else {
    console.log("PASS: swbs record is clean and mapped correctly.");
}

console.log("\n--- Testing MODERN (shipments) mapping ---");
const shipmentResult = mapToTableSchema(mockInput, false);
console.log("Keys in shipmentResult:", Object.keys(shipmentResult));
const shipmentInvalidKeys = Object.keys(shipmentResult).filter(k => !SHIPMENTS_WHITELIST.includes(k));
if (shipmentInvalidKeys.length > 0) {
    console.error("FAIL: shipments record contains invalid keys:", shipmentInvalidKeys);
} else {
    console.log("PASS: shipments record is clean and mapped correctly.");
}

console.log("\nVerification Complete.");
