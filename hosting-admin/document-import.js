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
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().split('T')[0];
    if (typeof v === 'number') {
        try {
            const date = new Date((v - 25569) * 86400 * 1000);
            return date.toISOString().split('T')[0];
        } catch (e) { return null; }
    }
    const str = String(v).trim();
    // Support formats: D/M/YYYY, M/D/YYYY, YYYY-MM-DD, D-M-YYYY
    const dateMatch = str.match(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/);
    if (!dateMatch) return null;

    const parts = dateMatch[0].split(/[-/.]/).filter(x => x.length > 0);
    if (parts.length < 3) return null;

    let m, d, y;
    if (parts[0].length === 4) { y = parts[0]; m = parts[1]; d = parts[2]; }
    else if (parts[2].length === 4 || parts[2].length === 2) {
        // Handle D/M or M/D ambiguity
        let p1 = parseInt(parts[0]), p2 = parseInt(parts[1]);
        if (p1 > 12) { d = p1; m = p2; } else { m = p1; d = p2; }
        y = parts[2].length === 2 ? "20" + parts[2] : parts[2];
    } else return null;

    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // --- Autonomous manifestation Parser ---

  function parseAutonomousExcel(rows) {
    if (!rows || rows.length === 0) return [];

    console.log('[Import] Starting Autonomous Analysis...');

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
    let headerCandidates = [];

    // 1. Scan for Metadata and Header Rows
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!Array.isArray(row)) continue;

        let score = 0;
        let mapping = {};

        for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || '').trim();
            if (!cell) continue;
            const low = cell.toLowerCase();

            // Metadata: Search for isolated labels or values
            if (low.includes('date') && !metadata.date) {
                // Check current cell or neighbors for a date value
                const neighbors = [cell, String(row[j+1] || ''), String(row[j+2] || '')];
                for (const n of neighbors) {
                    const d = cleanDate(n);
                    if (d) { metadata.date = d; break; }
                }
            }
            if ((low.includes('shipping no') || low.includes('manifest no')) && !metadata.shippingNo) {
                const neighbors = [cell, String(row[j+1] || ''), String(row[j+2] || '')];
                for (const n of neighbors) {
                    const id = cleanId(n.replace(/(shipping|manifest) no[:\s]*/i, ''));
                    if (id && id.length > 2 && !KEYWORDS.trackingId.some(k => n.toLowerCase() === k)) {
                        metadata.shippingNo = id; break;
                    }
                }
            }

            // Header Identification
            Object.keys(KEYWORDS).forEach(key => {
                if (KEYWORDS[key].some(k => low.includes(k))) {
                    if (!mapping[key]) { mapping[key] = j; score++; }
                }
            });
        }

        if (score >= 2) { // Lowered threshold for better discovery
            headerCandidates.push({ index: i, score, mapping });
        }
    }

    if (headerCandidates.length === 0) {
        console.warn('[Import] Autonomous header detection failed. Searching for data markers.');
        // Fallback: search for any row that looks like it has a tracking number
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!Array.isArray(row)) continue;
            const hasTracking = row.some(c => cleanId(c).match(/^(NC|NB|NM|NJ|NCS)/i));
            if (hasTracking) {
                console.log(`[Import] Found data marker at Row ${i + 1}`);
                // Use a generic mapping based on index if no keywords found
                const mapping = { trackingId: row.findIndex(c => cleanId(c).match(/^(NC|NB|NM|NJ|NCS)/i)) };
                headerCandidates.push({ index: i - 1, score: 1, mapping });
                break;
            }
        }
    }

    if (headerCandidates.length === 0) return [];

    // Select the best header row (most matches)
    headerCandidates.sort((a, b) => b.score - a.score);
    const bestHeader = headerCandidates[0];
    const headerRowIndex = bestHeader.index;
    const mapping = bestHeader.mapping;

    console.log(`[Import] Header Lock: Row ${headerRowIndex + 1}`, mapping);

    // 2. Data Clustering & Extraction
    const shipments = [];
    const get = (key, rowData) => {
        const idx = mapping[key];
        return (idx !== undefined && rowData) ? rowData[idx] : null;
    };

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!Array.isArray(r) || !r.some(c => String(c).trim())) continue;

        let tracking = cleanId(get('trackingId', r));

        // If tracking ID is missing but we have metadata at top, we might be in the first record
        if (!tracking && shipments.length === 0) tracking = metadata.shippingNo;

        // Skip potential secondary header rows
        const rowText = r.join(' ').toLowerCase();
        if (Object.keys(KEYWORDS).some(key => KEYWORDS[key].filter(k => k.length > 4).some(k => rowText.includes(k))) && !tracking) {
            console.log(`[Import] Skipping probable header artifact at Row ${i + 1}`);
            continue;
        }

        const hasIdentity = ['sender', 'receiver', 'destination', 'trackingId'].some(k => get(k, r));

        if (hasIdentity) {
            const current = {
                trackingId: tracking || (metadata.shippingNo ? `${metadata.shippingNo}-${shipments.length + 1}` : `AUTO-${Date.now()}-${shipments.length}`),
                shippingNumber: metadata.shippingNo || '',
                date: cleanDate(get('date', r)) || metadata.date,
                branchCode: String(get('branchCode', r) || '').trim(),
                swbSerial: String(get('swbSerial', r) || '').trim(),
                customerInvoice: String(get('customerInvoice', r) || '').trim(),
                sender: String(get('sender', r) || '').trim(),
                receiver: String(get('receiver', r) || '').trim(),
                destination: String(get('destination', r) || '').trim(),
                receiverAddress: String(get('receiverAddress', r) || '').trim(),
                originalQuantity: parseInt(get('originalQuantity', r) || 0),
                quantity: parseInt(get('quantity', r) || 0),
                originalWeight: parseFloat(get('originalWeight', r) || 0),
                weight: parseFloat(get('weight', r) || 0),
                status: 'Pending',
                source: 'import',
                importedAt: new Date().toISOString()
            };

            // Multi-row record consolidation
            let lookAhead = i + 1;
            while (lookAhead < rows.length) {
                const next = rows[lookAhead];
                if (!Array.isArray(next) || !next.some(c => String(c).trim())) { lookAhead++; continue; }

                const nextId = cleanId(get('trackingId', next));
                const nextIdentity = ['sender', 'receiver', 'destination'].some(k => get(k, next));

                // If next row has no ID and no identity details, but has measurements, merge it
                if (!nextId && !nextIdentity) {
                    current.originalQuantity = current.originalQuantity || parseInt(get('originalQuantity', next) || 0);
                    current.quantity = current.quantity || parseInt(get('quantity', next) || 0);
                    current.originalWeight = current.originalWeight || parseFloat(get('originalWeight', next) || 0);
                    current.weight = current.weight || parseFloat(get('weight', next) || 0);
                    i = lookAhead;
                    lookAhead++;
                } else {
                    break;
                }
            }

            // Sanity check
            if (!current.quantity) current.quantity = 1;
            if (!current.originalQuantity) current.originalQuantity = current.quantity;

            shipments.push(current);
        }
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
            const sheet = wb.Sheets[wb.SheetNames[0]];
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

    tbody.innerHTML = importState.shipments.map(s => {
        const isDupe = importState.existingIds.includes(s.trackingId);
        return `
            <tr class="${isDupe ? 'is-duplicate' : ''}">
                <td class="${isDupe ? 'is-duplicate-badge' : 'is-new-badge'}">${isDupe ? 'DUPE' : 'NEW'}</td>
                <td style="font-weight:800;">${s.trackingId}</td>
                <td>${s.date || '—'}</td>
                <td>${s.branchCode || '—'}</td>
                <td>${s.swbSerial || '—'}</td>
                <td>${s.customerInvoice || '—'}</td>
                <td>${s.sender || '—'}</td>
                <td>${s.receiver || '—'}</td>
                <td>${s.originalQuantity || '—'}</td>
                <td>${s.quantity}</td>
                <td>${s.originalWeight || '—'}</td>
                <td>${s.weight}kg</td>
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

    let success = 0, failed = 0, duplicates = 0;
    const db = getDb();

    for (let i = 0; i < importState.shipments.length; i++) {
        const s = importState.shipments[i];
        if (importState.existingIds.includes(s.trackingId)) {
            duplicates++;
            continue;
        }
        try {
            await db.saveShipment(s.trackingId, { ...s, public: true });
            success++;
        } catch (e) {
            console.error('Import Sync failed:', s.trackingId, e);
            failed++;
        }
        setProgress(10 + Math.round((i / importState.shipments.length) * 90), `Syncing: ${i+1}/${importState.shipments.length}`);
    }

    alert(`Sync Result:\n✅ Success: ${success}\n⏭️ Skipped: ${duplicates}\n❌ Failed: ${failed}`);
    window.closeImportModal();
    if (typeof window.loadDashboard === 'function') window.loadDashboard();
  };

  // --- Logic Listeners ---

  function setup() {
    document.addEventListener('click', (e) => {
        if (e.target.closest('#btnOpenImportModal')) window.openImportModal();
        if (e.target.closest('#importUploadZone')) $id('importFileInput').click();
    }, true);

    document.addEventListener('change', (e) => {
        if (e.target.id === 'importFileInput' && e.target.files[0]) {
            const file = e.target.files[0];
            $id('importUploadZone').style.display = 'none';
            $id('importFileDetails').style.display = 'block';
            $id('importFileName').textContent = file.name;
            $id('importFileSize').textContent = `${(file.size / 1024).toFixed(1)} KB`;
            processFile(file);
        }
    });

    document.addEventListener('dragover', (e) => {
        if (e.target.closest('#importUploadZone')) { e.preventDefault(); e.target.closest('#importUploadZone').classList.add('drag-over'); }
    });
    document.addEventListener('dragleave', (e) => {
        if (e.target.closest('#importUploadZone')) e.target.closest('#importUploadZone').classList.remove('drag-over');
    });
    document.addEventListener('drop', (e) => {
        if (e.target.closest('#importUploadZone')) {
            e.preventDefault();
            e.target.closest('#importUploadZone').classList.remove('drag-over');
            if (e.dataTransfer.files[0]) {
                const dt = new DataTransfer();
                dt.items.add(e.dataTransfer.files[0]);
                $id('importFileInput').files = dt.files;
                $id('importFileInput').dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    });
  }

  setup();

})();
