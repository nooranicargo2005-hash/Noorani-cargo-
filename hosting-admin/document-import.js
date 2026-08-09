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
        modal.classList.add('is-open');
        window.resetImportModal();
    }
  };

  window.closeImportModal = () => {
    const modal = $id('importDataModal');
    if (modal) modal.classList.remove('is-open');
  };

  window.resetImportModal = () => {
    importState = { file: null, type: null, shipments: [], existingIds: [] };
    if ($id('importUploadZone')) $id('importUploadZone').style.display = 'flex';
    if ($id('importFileDetails')) $id('importFileDetails').style.display = 'none';
    if ($id('importProgress')) $id('importProgress').style.display = 'none';
    if ($id('importPreviewArea')) $id('importPreviewArea').style.display = 'none';
    if ($id('btnExecuteImport')) $id('btnExecuteImport').disabled = true;
    if ($id('importProgressBar')) $id('importProgressBar').style.width = '0%';
    if ($id('importFileInput')) $id('importFileInput').value = '';
  };

  const setProgress = (percent, status, isError = false) => {
    const pArea = $id('importProgress');
    if (pArea) pArea.style.display = 'block';
    const bar = $id('importProgressBar');
    if (bar) bar.style.width = `${percent}%`;
    const st = $id('importProgressStatus');
    if (st) {
        st.textContent = status;
        st.style.color = isError ? 'var(--noorani-danger)' : 'var(--noorani-gold)';
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

    console.log('%c[Import] Starting Dedicated Manifest Parser...', 'color: #3b82f6;');

    const KEYWORDS = {
        trackingId: ['tracking', 'shipping no', 'awb', 'serial', 's.no', 'manifest no', 'ref', 'no.', 'no', 'consignment'],
        date: ['date', 'swb date', 'shipment date', 'manifest date', 'booking date'],
        branchCode: ['branch', 'hub', 'origin', 'station', 'from'],
        swbSerial: ['swb serial', 'serial no', 'swb no', 'doc no', 'bag no'],
        customerInvoice: ['invoice', 'customer invoice', 'inv', 'bill no', 'cust inv'],
        sender: ['shipper', 'sender', 'shipper name', 'consignor', 'from name'],
        receiver: ['consignee', 'receiver', 'consignee name', 'client', 'to name'],
        originalQuantity: ['orig qty', 'original quantity', 'pcs', 'orig pieces', 'booking qty', 'booked pcs'],
        quantity: ['qty', 'quantity', 'pieces', 'actual qty', 'no of packages', 'pkgs'],
        originalWeight: ['orig weight', 'original weight', 'orig wgt', 'booking weight', 'booked weight'],
        weight: ['weight', 'wgt', 'kg', 'kilograms', 'actual weight', 'gross weight', 'net weight'],
        destination: ['destination', 'city', 'consignee city', 'port', 'to city'],
        receiverAddress: ['address', 'consignee address', 'receiver address', 'delivery address', 'to address']
    };

    let metadata = { date: null, shippingNo: null };

    // 1. Metadata Scan (First 12 rows)
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
        const row = rows[i];
        if (!Array.isArray(row)) continue;
        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || '').trim();
            if (!cell) continue;
            const low = cell.toLowerCase();

            if (low.includes('date') && !metadata.date) {
                const candidates = [cell.replace(/date[:\s]*/i, ''), String(row[j+1]||''), String(row[j+2]||''), (rows[i+1] ? String(rows[i+1][j]||'') : '')];
                for (const cand of candidates) {
                    const d = cleanDate(cand);
                    if (d) { metadata.date = d; break; }
                }
            }
            if ((low.includes('shipping no') || low.includes('manifest no')) && !metadata.shippingNo) {
                const candidates = [cell.replace(/(shipping|manifest) no[:\s]*/i, ''), String(row[j+1]||''), String(row[j+2]||'')];
                for (const cand of candidates) {
                    const id = cleanId(cand);
                    if (id && id.length > 2 && !KEYWORDS.trackingId.some(k => cand.toLowerCase() === k)) {
                        metadata.shippingNo = id; break;
                    }
                }
            }
        }
    }

    // 2. Header Mapping (Rows 13-14 - index 12-13)
    let mapping = {};
    const headerRows = [rows[12] || [], rows[13] || []];

    headerRows.forEach(hRow => {
        for (let j = 0; j < hRow.length; j++) {
            const cell = String(hRow[j] || '').trim().toLowerCase();
            if (!cell) continue;
            Object.keys(KEYWORDS).forEach(key => {
                if (KEYWORDS[key].some(k => cell === k || cell.includes(k))) {
                    if (mapping[key] === undefined) mapping[key] = j;
                }
            });
        }
    });

    // Fallback if row 13 didn't work (scan up to row 20)
    if (Object.keys(mapping).length < 3) {
        for (let i = 12; i < Math.min(rows.length, 20); i++) {
            const r = rows[i];
            let score = 0;
            let tempMapping = {};
            r.forEach((c, j) => {
                const val = String(c || '').trim().toLowerCase();
                Object.keys(KEYWORDS).forEach(key => {
                    if (KEYWORDS[key].some(k => val === k || val.includes(k))) {
                        if (tempMapping[key] === undefined) { tempMapping[key] = j; score++; }
                    }
                });
            });
            if (score > Object.keys(mapping).length) {
                mapping = tempMapping;
                console.log(`[Import] Alternative Header found at Row ${i + 1}`);
            }
        }
    }

    const shipments = [];
    const get = (key, rowData) => (mapping[key] !== undefined && rowData) ? rowData[mapping[key]] : null;

    // 3. Data Processing (Starts from Row 15 - index 14, in pairs)
    for (let i = 14; i < rows.length; i += 2) {
        const r1 = rows[i];
        const r2 = rows[i+1];
        if (!Array.isArray(r1) || !r1.some(c => String(c).trim())) continue;

        let tracking = cleanId(get('trackingId', r1));
        if (!tracking) continue;

        const current = {
            trackingId: tracking,
            shippingNumber: metadata.shippingNo || '',
            date: cleanDate(get('date', r1)) || metadata.date,
            branchCode: String(get('branchCode', r1) || '').trim(),
            swbSerial: String(get('swbSerial', r1) || '').trim(),
            customerInvoice: String(get('customerInvoice', r1) || '').trim(),
            sender: String(get('sender', r1) || '').trim(),
            receiver: String(get('receiver', r1) || '').trim(),
            destination: String(get('destination', r1) || '').trim(),
            receiverAddress: String(get('receiverAddress', r1) || '').trim(),
            // Measurements often on second row in these split formats
            originalQuantity: parseInt(get('originalQuantity', r1) || get('originalQuantity', r2) || 0, 10),
            quantity: parseInt(get('quantity', r1) || get('quantity', r2) || 0, 10),
            originalWeight: parseFloat(get('originalWeight', r1) || get('originalWeight', r2) || 0),
            weight: parseFloat(get('weight', r1) || get('weight', r2) || 0),
            status: 'Pending',
            source: 'import',
            importedAt: new Date().toISOString()
        };

        if (!current.quantity) current.quantity = 1;
        if (!current.originalQuantity) current.originalQuantity = current.quantity;

        shipments.push(current);
    }

    console.log(`[Import] Discovery Results: ${shipments.length} records.`);
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
            const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

            if (!wb.SheetNames || wb.SheetNames.length === 0) {
                throw new Error('Excel file appears to be empty or invalid (no sheets found).');
            }

            const sheetName = wb.SheetNames[0];
            const sheet = wb.Sheets[sheetName];

            if (!sheet) {
                throw new Error(`Could not access sheet: ${sheetName}`);
            }

            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
            data = parseAutonomousExcel(rows);

        } else if (ext === 'csv') {
            data = await new Promise(res => {
                Papa.parse(file, { header: false, skipEmptyLines: true, complete: r => res(parseAutonomousExcel(r.data)) });
            });
        }

        importState.shipments = data;

        if (data.length === 0) {
            setProgress(0, 'Failed to discover shipments. Please verify the manifest format.', true);
        } else {
            renderPreview();
            setProgress(100, `Successfully mapped ${data.length} shipments.`);
            setTimeout(() => { if($id('importProgress')) $id('importProgress').style.display = 'none'; }, 2000);
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

    $id('importPreviewArea').style.display = 'block';
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
            const uz = $id('importUploadZone');
            const fd = $id('importFileDetails');
            const fn = $id('importFileName');
            const fs = $id('importFileSize');

            if (uz) uz.style.display = 'none';
            if (fd) fd.style.display = 'block';
            if (fn) fn.textContent = file.name;
            if (fs) fs.textContent = `${(file.size / 1024).toFixed(1)} KB`;
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
