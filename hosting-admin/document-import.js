import { nooraniDb } from './firebase.js';

/**
 * Noorani Cargo Enterprise | Professional Data Import Engine
 * Version: 2026-08-09 v25 (Complete E2E | CSV, Excel, PDF)
 */

(function () {
  'use strict';

  console.log('%c[Import Engine] System v25 Online', 'color: #f4b400; font-weight: bold;');

  const $id = id => document.getElementById(id);
  const getDb = () => nooraniDb || window.nooraniDb;

  // Extraction Patterns
  const patterns = {
    tracking: /\b(NC|NB|NM|NCS|NJ)[-/]?\d+\b/gi,
    date: /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b|\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g,
    weight: /\b(\d+(?:\.\d+)?)\s*(?:KG|KILOGRAMS|KGS)\b/i,
    quantity: /\b(\d+)\s*(?:PCS|PIECES|QTY|QUANTITY)\b/i,
    phone: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,}\b/g,
    invoice: /\b(?:INV|INVOICE|REF)[:\s]*([A-Z0-9_-]+)\b/i
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
    const parts = String(v).split(/[-/]/);
    if (parts.length !== 3) return null;
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

  // --- Data Mapping ---

  function mapRecord(r) {
    const id = cleanId(r.trackingId || r.tracking || r.ID || r['Tracking #'] || r['Tracking Number']);
    let rawDate = r.date || r['Shipment Date'] || r.Date || r.shipmentDate;
    if (typeof rawDate === 'number') rawDate = new Date((rawDate - 25569) * 86400 * 1000).toISOString().split('T')[0];

    return {
        trackingId: id,
        ref: r.ref || r.Reference || r.invoice || r['Invoice #'] || id,
        date: cleanDate(rawDate),
        sender: r.sender || r['Sender Name'] || r['Sender'] || '',
        senderPhone: r.senderPhone || r['Sender Phone'] || '',
        receiver: r.receiver || r.consignee || r['Receiver Name'] || r['Receiver'] || r['Consignee'] || '',
        receiverPhone: r.receiverPhone || r['Receiver Phone'] || '',
        destination: r.destination || r.dest || r['Destination City'] || '',
        shipmentType: r.shipmentType || r.type || r.service || r['Shipment Type'] || 'Air Freight',
        weight: parseFloat(r.weight || r['Weight'] || r['Weight (KG)'] || 0),
        quantity: parseInt(r.quantity || r.qty || r.pieces || r['Quantity'] || r['Pieces'] || 1),
        shippingCost: parseFloat(r.shippingCost || r.cost || r['Shipping Cost'] || 0),
        paymentStatus: r.paymentStatus || r.payment || r['Payment Status'] || 'Unpaid',
        status: r.status || r['Status'] || 'Pending',
        notes: r.notes || r['Notes'] || '',
        source: 'import'
    };
  }

  // --- Logic ---

  async function processFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    setProgress(10, 'Checking API Status...');

    try {
        const db = getDb();
        // Duplicate check pre-fetch
        setProgress(20, 'Analyzing Database...');
        const existing = await db.queryShipments({ limit: 5000 });
        importState.existingIds = (existing && existing.items) ? existing.items.map(x => x.trackingId) : [];

        let data = [];
        setProgress(40, `Parsing ${ext.toUpperCase()} Manifest...`);

        if (ext === 'csv') {
            data = await new Promise(res => {
                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    complete: r => res(r.data.map(mapRecord))
                });
            });
        } else if (ext === 'xlsx' || ext === 'xls') {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer);
            data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]).map(mapRecord);
        } else if (ext === 'pdf') {
            const pdfjsLib = window.pdfjsLib;
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const lines = {};
                textContent.items.forEach(item => {
                    const y = Math.round(item.transform[5]);
                    lines[y] = (lines[y] || '') + ' ' + item.str;
                });

                // Sort lines by Y descending
                const sortedY = Object.keys(lines).sort((a,b) => b - a);
                sortedY.forEach(y => {
                    const line = lines[y];
                    const trackMatch = line.match(patterns.tracking);
                    if (trackMatch) {
                        const id = cleanId(trackMatch[0]);
                        const dateMatch = line.match(patterns.date);
                        const weightMatch = line.match(patterns.weight);
                        const qtyMatch = line.match(patterns.quantity);
                        const cleanLine = line.replace(patterns.tracking, '').replace(patterns.date, '').replace(patterns.weight, '').replace(patterns.quantity, '');
                        const names = cleanLine.split(/\s{3,}/).map(s => s.trim()).filter(s => s.length > 2);
                        data.push({
                            trackingId: id,
                            date: cleanDate(dateMatch ? dateMatch[0] : null),
                            sender: names[0] || '',
                            receiver: names[1] || '',
                            weight: weightMatch ? parseFloat(weightMatch[1]) : 0,
                            quantity: qtyMatch ? parseInt(qtyMatch[1]) : 1,
                            shipmentType: 'PDF Extract',
                            source: 'pdf'
                        });
                    }
                });
            }
        }

        importState.shipments = data.filter(s => s.trackingId);
        setProgress(90, 'Generating Preview...');
        renderPreview();
        setProgress(100, `Found ${importState.shipments.length} shipments.`);
        setTimeout(() => $id('importProgress').style.display = 'none', 1500);

    } catch (e) {
        console.error('[Import] Error:', e);
        setProgress(0, `SYNC ERROR: ${e.message}`, true);
    }
  }

  function renderPreview() {
    const tbody = $id('importPreviewBody');
    if (!tbody) return;

    tbody.innerHTML = importState.shipments.map(s => {
        const isDupe = importState.existingIds.includes(s.trackingId);
        const isMissing = !s.date || !s.sender || !s.receiver;

        return `
            <tr class="${isDupe ? 'is-duplicate' : ''}">
                <td class="${isDupe ? 'is-duplicate-badge' : 'is-new-badge'}">${isDupe ? 'DUPLICATE' : 'NEW'}</td>
                <td style="font-weight:800;">${s.trackingId}</td>
                <td class="${!s.date ? 'is-missing' : ''}">${s.date || '??'}</td>
                <td class="${!s.sender ? 'is-missing' : ''}">${s.sender || '??'}</td>
                <td class="${!s.receiver ? 'is-missing' : ''}">${s.receiver || '??'}</td>
                <td>${s.destination || '—'}</td>
                <td>${s.shipmentType}</td>
                <td>${s.weight}kg</td>
                <td>${s.quantity}</td>
                <td><small>${s.notes || ''}</small></td>
            </tr>
        `;
    }).join('');

    $id('importPreviewArea').style.display = 'block';
    $id('btnExecuteImport').disabled = importState.shipments.length === 0;
  }

  window.executeDataImport = async () => {
    const btn = $id('btnExecuteImport');
    btn.disabled = true; btn.textContent = 'Synchronizing...';

    let success = 0, failed = 0, skipped = 0;
    const db = getDb();
    const toImport = importState.shipments.filter(s => !importState.existingIds.includes(s.trackingId));
    skipped = importState.shipments.length - toImport.length;

    for (let i = 0; i < toImport.length; i++) {
        const s = toImport[i];
        try {
            await db.saveShipment(s.trackingId, { ...s, public: true });
            success++;
        } catch (e) {
            console.error('Save failed:', s.trackingId, e);
            failed++;
        }
        setProgress(Math.round((i/toImport.length)*100), `Syncing: ${i+1}/${toImport.length}`);
    }

    alert(`Final Sync Result:\n\n✅ Successfully Imported: ${success}\n⏭️ Skipped (Duplicates): ${skipped}\n❌ Failed: ${failed}`);
    window.closeImportModal();
    if (typeof window.loadDashboard === 'function') window.loadDashboard();
  };

  // --- Initializer ---

  function setup() {
    console.log('[Import System] Binding capture listeners');

    document.addEventListener('click', (e) => {
        if (e.target.closest('#btnOpenImportModal')) {
            e.preventDefault();
            e.stopPropagation();
            window.openImportModal();
        }
        if (e.target.closest('#importUploadZone')) {
            $id('importFileInput').click();
        }
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
