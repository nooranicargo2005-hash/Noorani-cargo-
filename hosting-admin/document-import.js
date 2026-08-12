/* global XLSX, Papa */

import { nooraniDb } from './firebase.js';

/**
 * Noorani Cargo Enterprise | Professional Data Import Engine
 * Version: 2026-08-09 v32 (Ultra-Intelligent Autonomous manifestation Parser)
 */

(function () {
  'use strict';

  console.log('%c[Import System] Engine v32 Online (Autonomous Mode)', 'color: #f4b400; font-weight: bold;');

  const $id = id => document.getElementById(id);
  const getDb = () => nooraniDb || window.nooraniDb;

  let importState = {
    file: null,
    type: null,
    shipments: [],
    existingIds: []
  };

  // --- UI Methods ---

  window.openImportModal = () => {
    const modal = $id('importDataModal');
    if (modal) {
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        window.resetImportModal();
    }
  };

  window.closeImportModal = () => {
    const modal = $id('importDataModal');
    if (modal) {
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
    }
  };

  window.resetImportModal = () => {
    importState = { file: null, type: null, shipments: [], existingIds: [] };
    const uz = $id('importUploadZone');
    const fd = $id('importFileDetails');
    const pg = $id('importProgress');
    const pa = $id('importPreviewArea');

    if (uz) uz.style.display = 'flex';
    if (fd) fd.classList.add('hidden');
    if (pg) pg.classList.add('hidden');
    if (pa) pa.classList.add('hidden');

    if ($id('btnExecuteImport')) $id('btnExecuteImport').disabled = true;
    if ($id('importProgressBar')) $id('importProgressBar').style.width = '0%';
    if ($id('importFileInput')) $id('importFileInput').value = '';
  };

  const setProgress = (percent, status, isError = false) => {
    const pArea = $id('importProgress');
    if (pArea) pArea.classList.remove('hidden');
    const bar = $id('importProgressBar');
    if (bar) bar.style.width = `${percent}%`;
    const st = $id('importProgressStatus');
    if (st) {
        st.textContent = status;
        st.style.color = isError ? 'var(--n-danger)' : 'var(--n-gold)';
    }
  };

  // --- Normalizers ---

  function cleanId(v) { return String(v || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''); }

  function cleanDate(v) {
    if (v === null || v === undefined || v === '') return null;

    // 1. Handle Date objects (Avoid UTC offset shift)
    if (v instanceof Date) {
        const y = v.getFullYear();
        const m = String(v.getMonth() + 1).padStart(2, '0');
        const d = String(v.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // 2. Handle Excel Numeric Dates
    if (typeof v === 'number') {
        try {
            const date = new Date(Math.round((v - 25569) * 86400 * 1000));
            if (!isNaN(date.getTime())) {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        } catch (e) {}
    }

    const str = String(v).trim();
    if (!str || str.length < 5) return null;

    // 3. Try common numeric patterns: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
    const numericMatch = str.match(/(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})/);
    if (numericMatch) {
        let p1 = numericMatch[1], p2 = numericMatch[2], p3 = numericMatch[3];
        let y, m, d;
        if (p1.length === 4) { // YYYY-MM-DD
            y = p1; m = p2; d = p3;
        } else { // DD-MM-YYYY or MM-DD-YYYY
            y = p3.length === 2 ? "20" + p3 : p3;
            let v1 = parseInt(p1, 10), v2 = parseInt(p2, 10);
            if (v1 > 12) { d = v1; m = v2; }
            else if (v2 > 12) { m = v1; d = v2; }
            else { d = v1; m = v2; } // Default to D/M/Y (09/08/2026 -> Aug 9)
        }
        if (y && m && d && y.length === 4) {
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }

    // 4. Try month names: 09-Aug-2026, Aug 09 2026
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const textMatch = str.match(/(\d{1,2})[-/\s,]+([a-z]{3,})[-/\s,]+(\d{2,4})/i) ||
                      str.match(/([a-z]{3,})[-/\s,]+(\d{1,2})[-/\s,]+(\d{2,4})/i);

    if (textMatch) {
        let dStr, mStr, yStr;
        if (isNaN(parseInt(textMatch[1], 10))) { mStr = textMatch[1]; dStr = textMatch[2]; yStr = textMatch[3]; }
        else { dStr = textMatch[1]; mStr = textMatch[2]; yStr = textMatch[3]; }

        const mIdx = monthNames.findIndex(m => mStr.toLowerCase().startsWith(m));
        if (mIdx !== -1) {
            const y = yStr.length === 2 ? "20" + yStr : yStr;
            const m = String(mIdx + 1).padStart(2, '0');
            const d = String(parseInt(dStr, 10)).padStart(2, '0');
            if (y.length === 4) return `${y}-${m}-${d}`;
        }
    }

    // 5. Final fallback: JS native parse (use with caution)
    const parsed = Date.parse(str);
    if (!isNaN(parsed)) {
        const date = new Date(parsed);
        if (date.getFullYear() > 2000) {
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
    }

    return null;
  }

  // --- Autonomous manifestation Parser ---

  function parseAutonomousExcel(rows) {
    if (!rows || rows.length === 0) return [];

    console.log('%c[Import] Activating Smart Header Discovery...', 'color: #3b82f6;');

    const KEYWORDS = {
        trackingId: ['tracking', 'shipping no', 'awb', 'serial', 's.no', 'manifest no', 'ref', 'no.', 'no', 'consignment', 'waybill'],
        date: ['date', 'swb date', 'shipment date', 'manifest date', 'booking date', 'registration'],
        branchCode: ['branch', 'hub', 'origin', 'station', 'from', 'org', 'sales branch'],
        swbSerial: ['swb serial no', 'swb serial', 'swb no', 'bag no', 'swb'],
        swbDate: ['swb date'],
        shippingNumber: ['cust inv no', 'cust inv', 'manifest no', 'shipping no'],
        customerInvoice: ['customer inv no', 'customer invoice no', 'customer invoice', 'cust inv', 'invoice no'],
        branchCode: ['customer', 'branch', 'hub', 'origin', 'station', 'from', 'org', 'sales branch'],
        sender: ['shipper name', 'shipper', 'sender', 'consignor', 'from name'],
        receiver: ['consignee name', 'consignee', 'receiver', 'client', 'to name'],
        originalQuantity: ['orig qty', 'original quantity', 'pcs', 'orig pieces', 'booking qty', 'booked pcs'],
        quantity: ['qty', 'quantity', 'pieces', 'actual qty', 'no of packages', 'pkgs', 'total qty'],
        originalWeight: ['orig wt', 'orig weight', 'original weight', 'orig wgt', 'booking weight', 'booked weight'],
        weight: ['wt', 'weight', 'wgt', 'kg', 'kilograms', 'actual weight', 'gross weight', 'net weight', 'total weight'],
        destination: ['consignee city', 'destination', 'city', 'port', 'to city', 'dest'],
        receiverAddress: ['consingee addr', 'consingee address', 'consignee address', 'receiver address', 'delivery address', 'to address'],
        senderPhone: ['shipper phone', 'sender phone', 'shipper tel', 'sender tel', 'shipper mobile', 'sender mobile'],
        receiverPhone: ['consignee phone', 'receiver phone', 'consignee tel', 'receiver tel', 'consignee mobile', 'receiver mobile'],
        originCountry: ['origin country', 'from country', 'origin nation', 'org country'],
        destinationCountry: ['destination country', 'to country', 'final country', 'dest country'],
        shipmentType: ['shipment type', 'freight type', 'cargo type', 'type of shipment', 'mode'],
        route: ['route'],
        milestone1: ['1. loaded in saudi'],
        milestone2: ['2. jeddah port transit'],
        milestone3: ['3. sea voyage'],
        milestone4: ['4. karachi port arrival'],
        milestone5: ['5. transfer to lahore'],
        milestone6: ['6. final delivery'],
        status: ['overall status', 'status']
    };

    let headerRowIndex = -1;
    let mapping = {};
    let metadata = { date: null, shippingNo: null };

    // 1. Unified Discovery Scan
    for (let i = 0; i < Math.min(rows.length, 50); i++) {
        const row = rows[i];
        if (!Array.isArray(row)) continue;

        let rowMapping = {};
        let matches = 0;

        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || '').trim().toLowerCase();
            if (!cell) continue;

            // Header Matching
            Object.keys(KEYWORDS).forEach(key => {
                if (KEYWORDS[key].some(k => cell === k || cell.includes(k))) {
                    if (rowMapping[key] === undefined) {
                        rowMapping[key] = j;
                        matches++;
                    }
                }
            });

            // Metadata Matching (Date/Shipping No) in non-header rows
            if (headerRowIndex === -1) {
                if (cell.includes('date') && !metadata.date) {
                    const d = cleanDate(row[j+1]) || cleanDate(row[j+2]);
                    if (d) metadata.date = d;
                }
                if ((cell.includes('shipping no') || cell.includes('manifest no')) && !metadata.shippingNo) {
                    const id = cleanId(row[j+1]) || cleanId(row[j+2]);
                    if (id && id.length > 3) metadata.shippingNo = id;
                }
            }
        }

        // Determine if this is the header row (Need at least 3 keyword matches)
        if (matches >= 3 && matches > Object.keys(mapping).length) {
            mapping = rowMapping;
            headerRowIndex = i;
            console.log(`[Import] Header Row Discovered at Index: ${i} with ${matches} matches.`);
        }
    }

    if (headerRowIndex === -1) {
        console.warn('[Import] Automated header discovery failed. Attempting fallback mapping...');
        // Fallback: Assume Row 0 if everything else fails but data exists
        if (rows.length > 1) headerRowIndex = 0;
        else return [];
    }

    const shipments = [];
    const getVal = (key, rowData) => (mapping[key] !== undefined && rowData) ? rowData[mapping[key]] : null;

    // 2. Data Extraction
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!Array.isArray(r) || !r.some(c => String(c).trim())) continue;

        let tracking = cleanId(getVal('trackingId', r));
        if (!tracking || tracking.length < 3) continue;

        const current = {
            trackingId: tracking,
            date: cleanDate(getVal('date', r)) || metadata.date || new Date().toISOString().split('T')[0],
            swbSerial: String(getVal('swbSerial', r) || '').trim(),
            shippingNumber: String(getVal('shippingNumber', r) || '').trim() || metadata.shippingNo || '',
            swbDate: cleanDate(getVal('swbDate', r)) || '',
            branchCode: String(getVal('branchCode', r) || '').trim(),
            customerInvoice: String(getVal('customerInvoice', r) || '').trim(),
            sender: String(getVal('sender', r) || '').trim(),
            senderPhone: String(getVal('senderPhone', r) || '').trim(),
            receiver: String(getVal('receiver', r) || '').trim(),
            receiverPhone: String(getVal('receiverPhone', r) || '').trim(),
            destination: String(getVal('destination', r) || '').trim(),
            receiverAddress: String(getVal('receiverAddress', r) || '').trim(),
            originCountry: String(getVal('originCountry', r) || '').trim(),
            destinationCountry: String(getVal('destinationCountry', r) || '').trim(),
            shipmentType: String(getVal('shipmentType', r) || 'Air Freight').trim(),
            route: String(getVal('route', r) || '').trim(),
            milestone1: cleanDate(getVal('milestone1', r)) || '',
            milestone2: cleanDate(getVal('milestone2', r)) || '',
            milestone3: cleanDate(getVal('milestone3', r)) || '',
            milestone4: cleanDate(getVal('milestone4', r)) || '',
            milestone5: cleanDate(getVal('milestone5', r)) || '',
            milestone6: cleanDate(getVal('milestone6', r)) || '',
            originalQuantity: parseInt(getVal('originalQuantity', r) || 0, 10),
            quantity: parseInt(getVal('quantity', r) || 1, 10),
            originalWeight: parseFloat(getVal('originalWeight', r) || 0),
            weight: parseFloat(getVal('weight', r) || 0),
            status: String(getVal('status', r) || 'Pending').trim(),
            source: 'import',
            importedAt: new Date().toISOString()
        };
            quantity: parseInt(getVal('quantity', r) || 1, 10),
            originalWeight: parseFloat(getVal('originalWeight', r) || 0),
            weight: parseFloat(getVal('weight', r) || 0),
            status: 'Pending',
            source: 'import',
            importedAt: new Date().toISOString()
        };

        if (!current.originalQuantity) current.originalQuantity = current.quantity;
        if (!current.originalWeight) current.originalWeight = current.weight;

        shipments.push(current);
    }

    console.log(`[Import] DISCOVERY COMPLETE: Found ${shipments.length} valid shipment records.`);
    return shipments;
  }

  // --- Core Processing Engine ---

  async function processFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    setProgress(10, 'Activating autonomous engine...');

    try {
        const db = getDb();
        if (!db) throw new Error('Database bridge offline.');

        setProgress(20, 'Comparing with existing database...');
        const existing = await db.queryShipments({ limit: 10000 });
        importState.existingIds = (existing && existing.items) ? existing.items.map(x => x.trackingId) : [];

        let data = [];
        setProgress(40, `Ingesting ${ext.toUpperCase()} file...`);

        if (ext === 'xlsx' || ext === 'xls') {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: false, cellText: false });

            if (!wb.SheetNames || wb.SheetNames.length === 0) {
                throw new Error('Excel file appears to be empty or invalid (no sheets found).');
            }

            const sheetName = wb.SheetNames[0];
            const sheet = wb.Sheets[sheetName];

            // Log sheet range for debugging
            console.log(`[Import] Processing Sheet: ${sheetName}, Range: ${sheet['!ref']}`);

            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
            console.log(`[Import] Raw row count: ${rows.length}`);

            data = parseAutonomousExcel(rows);

        } else if (ext === 'csv') {
            data = await new Promise((resolve, reject) => {
                Papa.parse(file, {
                    header: false,
                    skipEmptyLines: true,
                    complete: r => resolve(parseAutonomousExcel(r.data)),
                    error: err => reject(err)
                });
            });
        }

        importState.shipments = data;

        if (!data || data.length === 0) {
            console.error('[Import] Discovery FAILED: No records found after parsing.');
            setProgress(0, 'Failed to discover shipments. Please verify the manifest format.', true);
        } else {
            console.log(`[Import] Discovery SUCCESS: Mapped ${data.length} shipments.`);
            renderPreview();
            setProgress(100, `Successfully mapped ${data.length} shipments.`);
            setTimeout(() => { if($id('importProgress')) $id('importProgress').classList.add('hidden'); }, 2000);
        }

    } catch (e) {
        console.error('[Import] Critical System Error:', e);
        setProgress(0, `Engine Failure: ${e.message}`, true);
    }
  }

  function renderPreview() {
    const tbody = $id('importPreviewBody');
    if (!tbody) return;

    const updateExisting = $id('importUpdateToggle')?.checked;

    tbody.innerHTML = importState.shipments.map(s => {
        const isDupe = importState.existingIds.includes(s.trackingId);
        let statusText = 'NEW';
        let statusCls = 'is-new-badge';

        if (isDupe) {
            if (updateExisting) {
                statusText = 'UPDATE';
                statusCls = 'is-duplicate-badge'; // Reusing existing style or could add a specific one
            } else {
                statusText = 'SKIP';
                statusCls = 'is-duplicate-badge';
            }
        }

        return `
            <tr class="${isDupe && !updateExisting ? 'is-duplicate' : ''}">
                <td class="${statusCls}">${statusText}</td>
                <td style="font-weight:800; color:var(--n-gold);">${s.trackingId}</td>
                <td>${s.branchCode || '—'}</td>
                <td>${s.swbSerial || '—'}</td>
                <td>${s.customerInvoice || '—'}</td>
                <td>${s.date || '—'}</td>
                <td>${s.sender || '—'}</td>
                <td>${s.receiver || '—'}</td>
                <td>${s.originalQuantity || '—'}</td>
                <td>${s.quantity}</td>
                <td>${s.originalWeight || '—'}</td>
                <td>${s.weight}</td>
                <td>${s.destination || '—'}</td>
                <td><small>${s.receiverAddress || '—'}</small></td>
            </tr>
        `;
    }).join('');

    $id('importPreviewArea').classList.remove('hidden');
    $id('btnExecuteImport').disabled = importState.shipments.length === 0;
  }

  window.executeDataImport = async () => {
    const btn = $id('btnExecuteImport');
    if (btn) { btn.disabled = true; btn.textContent = 'Syncing...'; }

    const updateExisting = $id('importUpdateToggle')?.checked;
    let success = 0, failed = 0, duplicates = 0, updated = 0;
    const db = getDb();

    for (let i = 0; i < importState.shipments.length; i++) {
        const s = importState.shipments[i];
        const isDupe = importState.existingIds.includes(s.trackingId);

        if (isDupe && !updateExisting) {
            duplicates++;
            continue;
        }

        try {
            await db.saveShipment(s.trackingId, { ...s, public: true });
            if (isDupe) updated++;
            else success++;
        } catch (e) {
            console.error('Import Sync failed:', s.trackingId, e);
            failed++;
        }
        setProgress(10 + Math.round((i / importState.shipments.length) * 90), `Syncing: ${i+1}/${importState.shipments.length}`);
    }

    let resultMsg = `Sync Result:\n✅ New: ${success}`;
    if (updateExisting) resultMsg += `\n🔄 Updated: ${updated}`;
    else resultMsg += `\n⏭️ Skipped: ${duplicates}`;
    resultMsg += `\n❌ Failed: ${failed}`;

    alert(resultMsg);
    window.closeImportModal();
    if (typeof window.loadDashboard === 'function') window.loadDashboard();
  };

  // --- Logic Listeners ---

  function setup() {
    document.addEventListener('click', (e) => {
        if (e.target.closest('#btnOpenImportModal')) window.openImportModal();
        if (e.target.closest('#importUploadZone')) {
            const input = $id('importFileInput');
            if (input) input.click();
        }
    }, true);

    document.addEventListener('change', (e) => {
        if (e.target.id === 'importFileInput' && e.target.files[0]) {
            const file = e.target.files[0];
            const fd = $id('importFileDetails');
            const fn = $id('importFileName');
            const fs = $id('importFileSize');

            if (fd) fd.classList.remove('hidden');
            if (fn) fn.textContent = file.name;
            if (fs) fs.textContent = `${(file.size / 1024).toFixed(1)} KB`;

            // Persist manifest file to server storage permanently
            (async () => {
                try {
                    const db = getDb();
                    if (db && db.uploadManifestFile) {
                        console.log('[Import] Archiving manifest to server storage...');
                        const res = await db.uploadManifestFile(file);
                        console.log('[Import] Archive SUCCESS:', res.fileName);
                        console.log('[Import] Physical Path:', res.physicalPath);
                    } else {
                        console.error('[Import] Database bridge not ready for upload.');
                    }
                } catch (err) {
                    console.error('[Import] Archive FAILED:', err);
                }
            })();

            processFile(file);
        }
        if (e.target.id === 'importUpdateToggle') {
            if (importState.shipments.length > 0) renderPreview();
        }
    });

    document.addEventListener('dragover', (e) => {
        const uz = e.target.closest('#importUploadZone');
        if (uz) { e.preventDefault(); uz.classList.add('drag-over'); }
    });
    document.addEventListener('dragleave', (e) => {
        const uz = e.target.closest('#importUploadZone');
        if (uz) uz.classList.remove('drag-over');
    });
    document.addEventListener('drop', (e) => {
        const uz = e.target.closest('#importUploadZone');
        if (uz) {
            e.preventDefault();
            uz.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) {
                const dt = new DataTransfer();
                dt.items.add(e.dataTransfer.files[0]);
                const input = $id('importFileInput');
                if (input) {
                    input.files = dt.files;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }
    });
  }

  setup();

})();
