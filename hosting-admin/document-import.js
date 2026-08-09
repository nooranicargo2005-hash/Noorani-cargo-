import { nooraniDb } from './firebase.js';

/**
 * Noorani Cargo Enterprise | Professional Data Import Engine
 * Version: 2026-08-09 v28 (Special Multi-Row Excel Manifest Fix)
 */

(function () {
  'use strict';

  console.log('%c[Import System] Engine v28 Online (Multi-Row Mode)', 'color: #f4b400; font-weight: bold;');

  const $id = id => document.getElementById(id);
  const getDb = () => nooraniDb || window.nooraniDb;

  const patterns = {
    tracking: /\b(NC|NB|NM|NCS|NJ)[-/]?\d+\b/gi,
    date: /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b|\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g
  };

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
    if (typeof v === 'number') {
        try {
            const date = new Date((v - 25569) * 86400 * 1000);
            return date.toISOString().split('T')[0];
        } catch (e) { return null; }
    }
    const parts = String(v).split(/[-/.\s]/).filter(x => x.length > 0);
    if (parts.length < 3) return null;
    let m, d, y;
    if (parts[0].length === 4) { y = parts[0]; m = parts[1]; d = parts[2]; }
    else {
        m = parts[0]; d = parts[1]; y = parts[2];
        if (y.length === 2) y = "20" + y;
        if (parseInt(m) > 12) { const t = m; m = d; d = t; }
    }
    if (isNaN(m) || isNaN(d) || isNaN(y)) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // --- Multi-Row Logic ---

  function parseMultiRowExcel(rows) {
    const shipments = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const nextRow = rows[i + 1] || {};

        // Key map for row
        const r = {};
        Object.keys(row).forEach(k => r[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = row[k]);
        const nr = {};
        Object.keys(nextRow).forEach(k => nr[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = nextRow[k]);

        const trackingId = cleanId(r['trackingshippingno'] || r['trackingno'] || r['shipmentno']);

        if (trackingId && trackingId.length > 3) {
            // This looks like a main shipment row
            shipments.push({
                trackingId: trackingId,
                branchCode: r['branch'] || r['hub'] || '',
                swbSerial: r['swbserialno'] || r['serial'] || '',
                customerInvoice: r['customerinvoiceno'] || r['invoice'] || '',
                date: cleanDate(r['swbdate'] || r['date']),
                sender: r['shippername'] || r['shipper'] || '',
                receiver: r['consigneename'] || r['consignee'] || '',
                destination: r['consigneecity'] || r['city'] || '',
                receiverAddress: r['consigneeaddress'] || r['address'] || '',
                // Qty/Weight from current row OR next row (multi-row heuristic)
                originalQuantity: parseInt(r['originalqty'] || nr['originalqty'] || 1),
                quantity: parseInt(r['qty'] || nr['qty'] || 1),
                originalWeight: parseFloat(r['originalweight'] || nr['originalweight'] || 0),
                weight: parseFloat(r['weight'] || nr['weight'] || 0),
                status: 'Pending',
                source: 'import'
            });
            // If the next row was just for qty/weight, we skip it to avoid false positives
            if (!cleanId(nr['trackingshippingno'])) i++;
        }
    }
    return shipments;
  }

  // --- Logic ---

  async function processFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    setProgress(10, 'Initializing parser...');

    try {
        const db = getDb();
        if (!db) throw new Error('Database bridge not available.');

        setProgress(20, 'Checking existing records...');
        const existing = await db.queryShipments({ limit: 10000 });
        importState.existingIds = (existing && existing.items) ? existing.items.map(x => x.trackingId) : [];

        let data = [];
        setProgress(40, `Processing ${ext.toUpperCase()}...`);

        if (ext === 'xlsx' || ext === 'xls') {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
            const sheet = wb.Sheets[wb.SheetNames[0]];

            // Read rows as raw objects
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
            data = parseMultiRowExcel(rows);

        } else if (ext === 'csv') {
            data = await new Promise(res => {
                Papa.parse(file, { header: true, skipEmptyLines: true, complete: r => res(parseMultiRowExcel(r.data)) });
            });
        }

        importState.shipments = data;

        if (data.length === 0) {
            setProgress(0, 'Error: No shipments found. Please check Excel format.', true);
        } else {
            renderPreview();
            setProgress(100, `Successfully loaded ${data.length} records.`);
            setTimeout(() => { if($id('importProgress')) $id('importProgress').style.display = 'none'; }, 2000);
        }

    } catch (e) {
        console.error('[Import] Error:', e);
        setProgress(0, `Error: ${e.message}`, true);
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
                <td>${s.branchCode || '—'}</td>
                <td>${s.swbSerial || '—'}</td>
                <td>${s.customerInvoice || '—'}</td>
                <td>${s.date || '??'}</td>
                <td>${s.sender || '??'}</td>
                <td>${s.receiver || '??'}</td>
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
            console.error('Import fail:', s.trackingId, e);
            failed++;
        }
        setProgress(10 + Math.round((i / importState.shipments.length) * 90), `Syncing: ${i+1}/${importState.shipments.length}`);
    }

    alert(`Sync Result:\n✅ Success: ${success}\n⏭️ Skipped (Duplicates): ${duplicates}\n❌ Failed: ${failed}`);
    window.closeImportModal();
    if (typeof window.loadDashboard === 'function') window.loadDashboard();
  };

  // --- Listeners ---

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
