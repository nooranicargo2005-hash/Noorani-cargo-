/**
 * Noorani Cargo Enterprise | Professional Shipment Engine
 * Version: 2.9.0
 */

import { nooraniDb } from './firebase.js';

const $id = id => document.getElementById(id);
const getDb = () => nooraniDb || window.nooraniDb;

let pendingImportData = [];

// =====================================================
// DASHBOARD & ANALYTICS
// =====================================================

window.refreshDashboard = async () => {
    const db = getDb(); if (!db) return;
    try {
        const s = await db.getDashboardStats();
        if ($id('stat-total-swbs')) $id('stat-total-swbs').textContent = s.totalSwbs || 0;
        const b = s.breakdown || {};
        const mapping = {
            'stat-pending': ['Created', 'Received', 'Processing'],
            'stat-transit': ['Picked Up', 'In Transit', 'Allocated'],
            'stat-arrived': ['Arrived', 'Customs'],
            'stat-delivered': ['Delivered'],
            'stat-cancelled': ['Cancelled', 'Hold']
        };
        for (const [id, statuses] of Object.entries(mapping)) {
            const el = $id(id);
            if (el) el.textContent = statuses.reduce((sum, st) => sum + (b[st] || 0), 0);
        }
        const recentTbody = $id('recentSwbTableBody');
        if (recentTbody && s.recentItems) {
            recentTbody.innerHTML = s.recentItems.map(s => `
                <tr>
                    <td style="font-weight:700; color:var(--n-gold);">${s.swbSerial}</td>
                    <td>${s.customer || '—'}</td>
                    <td><span class="status-badge status-${(s.status || '').toLowerCase().replace(/ /g, '-')}">${s.status || 'Created'}</span></td>
                    <td>${window.nooraniUtils?.formatDate(s.swbDate) || s.swbDate || '—'}</td>
                    <td class="text-right"><button class="n-btn" onclick="window.viewShipment('${s.swbSerial}')"><i class="fa-solid fa-eye"></i></button></td>
                </tr>
            `).join('') || '<tr><td colspan="5" class="text-center text-muted">No activity stream.</td></tr>';
        }
    } catch (e) { console.error('[Dashboard] Stats Failed', e); }
};

window.loadDashboard = async () => {
    const db = getDb(); if (!db) return;
    const tbody = $id('swbTableBody'); if (!tbody) return;

    const filters = {
        search: $id('inventorySearch')?.value || '',
        status: $id('filterStatus')?.value || '',
        origin: $id('filterOrigin')?.value || '',
        destination: $id('filterDestination')?.value || '',
        manifestNo: $id('filterManifest')?.value || '',
        limit: 1000
    };

    try {
        tbody.innerHTML = '<tr><td colspan="13" class="text-center py-40"><i class="fa-solid fa-circle-notch fa-spin"></i> Synchronizing Network...</td></tr>';
        const res = await db.queryShipments(filters);
        const items = res.items || [];

        tbody.innerHTML = items.map(s => `
            <tr id="row_${s.swbSerial}">
                <td><input type="checkbox" class="swb-select" value="${s.swbSerial}"></td>
                <td style="font-weight:800; color:var(--n-gold); cursor:pointer;" onclick="window.viewShipment('${s.swbSerial}')">${s.swbSerial || 'N/A'}</td>
                <td><span class="status-badge status-${(s.status || 'created').toLowerCase().replace(/ /g, '-')}">${s.status || 'Created'}</span></td>
                <td>${s.customer || '—'}</td>
                <td>${s.shipperName || '—'}</td>
                <td>${s.consigneeName || '—'}</td>
                <td>${s.origin || '—'}</td>
                <td>${s.consigneeCity || '—'}</td>
                <td>${s.origQty || 0}</td>
                <td>${s.origWt ? s.origWt.toFixed(2) : '0.00'}</td>
                <td>${s.manifestNo || '—'}</td>
                <td>${window.nooraniUtils?.formatDate(s.created_at) || '—'}</td>
                <td class="text-right">
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button class="n-btn" title="View" onclick="window.viewShipment('${s.swbSerial}')"><i class="fa-solid fa-eye"></i></button>
                        <button class="n-btn" title="Edit" onclick="window.editShipment('${s.swbSerial}')"><i class="fa-solid fa-pen"></i></button>
                    </div>
                </td>
            </tr>
        `).join('') || `<tr><td colspan="13" class="text-center py-40 text-muted">No records found.</td></tr>`;
    } catch (e) {
        console.error('Fetch Error Detail:', e);
        tbody.innerHTML = `<tr><td colspan="13" class="text-center py-40 text-danger">
            <div style="font-weight:800; margin-bottom:8px;">Connectivity Failure</div>
            <div style="font-size:0.85rem; opacity:0.8;">${e.message}</div>
            <button class="n-btn mt-20" onclick="window.loadDashboard()"><i class="fa-solid fa-rotate"></i> RETRY CONNECTION</button>
        </td></tr>`;
    }
};

window.exportToExcel = async () => {
    try {
        const res = await getDb().queryShipments({ limit: 5000 });
        const items = res.items || [];
        const ws = XLSX.utils.json_to_sheet(items);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Shipments");
        XLSX.writeFile(wb, `Noorani_Cargo_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) { alert('Export Error: ' + e.message); }
};

// =====================================================
// SHIPMENT CRUD
// =====================================================

window.resetSwbForm = () => {
    ['swbSerial', 'swbDate', 'customer', 'shipperName', 'shipperPhone', 'shipperAddress', 'consigneeName', 'consigneePhone', 'consigneeAddress', 'swbOrigin', 'swbDestination', 'consigneeCity', 'origQty', 'origWt', 'swbStatus', 'swbNotes'].forEach(f => { if ($id(f)) $id(f).value = ''; });
    $id('swbSerial').disabled = false;
    $id('registrationHeader').innerHTML = '<i class="fa-solid fa-file-invoice" style="color:var(--n-gold); margin-right:12px;"></i> Shipment Documentation';
};

window.saveSwb = async (e) => {
    const db = getDb(); if (!db) return;
    const btn = (e && e.target) ? e.target.closest('button') : $id('btnSaveSwb');
    const id = $id('swbSerial').value.trim();
    if (!id) return alert('Serial Number required.');

    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> SAVING...';

    const payload = {
        swbDate: $id('swbDate').value,
        customer: $id('customer').value,
        shipperName: $id('shipperName').value,
        shipperPhone: $id('shipperPhone').value,
        shipperAddress: $id('shipperAddress').value,
        consigneeName: $id('consigneeName').value,
        consigneePhone: $id('consigneePhone').value,
        consigneeAddress: $id('consigneeAddress').value,
        consigneeCity: $id('consigneeCity').value,
        origQty: parseInt($id('origQty').value) || 0,
        origWt: parseFloat($id('origWt').value) || 0,
        status: $id('swbStatus')?.value || 'Created',
        origin: $id('swbOrigin')?.value || '',
        destination: $id('swbDestination')?.value || '',
        notes: $id('swbNotes')?.value || '',
        actorEmail: window.nooraniAdminUser?.email || 'admin'
    };

    try {
        await db.saveShipment(id, payload);
        alert('Shipment Synchronized.');
        window.resetSwbForm();
        history.pushState(null, '', '?page=swb-management');
        window.dispatchEvent(new Event('popstate'));
    } catch (err) { alert('Failure: ' + err.message); }
    finally { btn.disabled = false; btn.innerHTML = originalText; }
};

window.editShipment = async (id) => {
    try {
        const res = await getDb().getShipmentBySerial(id);
        const d = res.data;
        if (!d) return;

        $id('swbSerial').value = d.swbSerial;
        $id('swbSerial').disabled = true;
        $id('swbDate').value = d.swbDate || '';
        $id('customer').value = d.customer || '';
        $id('shipperName').value = d.shipperName || '';
        $id('consigneeName').value = d.consigneeName || '';
        $id('consigneeCity').value = d.consigneeCity || '';
        $id('swbStatus').value = d.status || 'Created';
        $id('origQty').value = d.origQty || '';
        $id('origWt').value = d.origWt || '';

        $id('registrationHeader').innerHTML = `<i class="fa-solid fa-pen-to-square" style="color:var(--n-gold); margin-right:12px;"></i> Edit Shipment: ${d.swbSerial}`;
        history.pushState(null, '', '?page=create-swb');
        window.dispatchEvent(new Event('popstate'));
    } catch (e) { alert('Load Error'); }
};

window.viewShipment = async (id) => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.getShipmentBySerial(id);
        const hist = await db.getShipmentHistory(id);
        const d = res.data;
        if (!d) return;

        $id('ws-serial').textContent = d.swbSerial;
        $id('ws-status-badge').textContent = d.status || 'Created';
        $id('ws-customer').textContent = d.customer || '—';
        $id('ws-shipper').textContent = d.shipperName || '—';
        $id('ws-consignee').textContent = d.consigneeName || '—';
        $id('ws-origin').textContent = d.origin || '—';
        $id('ws-destination').textContent = d.consigneeCity || '—';
        $id('ws-qty').textContent = d.origQty || '0';
        $id('ws-wt').textContent = d.origWt || '0';
        $id('ws-date').textContent = d.swbDate || '—';

        $id('ws-timeline').innerHTML = (hist.data || []).map(h => `
            <div class="timeline-item">
                <div class="timeline-point"></div>
                <div class="timeline-content">
                    <strong>${h.status}</strong>
                    <p style="font-size:0.75rem;">${new Date(h.created_at).toLocaleString()}<br>${h.remarks || ''}</p>
                </div>
            </div>
        `).join('') || '<p class="text-center text-muted">No timeline data.</p>';

        $id('shipmentWorkspaceModal').style.opacity = '1';
        $id('shipmentWorkspaceModal').style.pointerEvents = 'auto';
    } catch (e) { alert('View Failed'); }
};

window.closeShipmentWorkspace = () => {
    $id('shipmentWorkspaceModal').style.opacity = '0';
    $id('shipmentWorkspaceModal').style.pointerEvents = 'none';
};

window.updateBulkStatus = async () => {
    const status = $id('bulkStatusSelect').value;
    const selected = Array.from(document.querySelectorAll('.swb-select:checked')).map(cb => cb.value);
    if (!status || !selected.length) return alert('Select status and rows.');
    try {
        await getDb().bulkUpdateStatus(selected, status, 'Dashboard bulk update');
        alert('Update Applied.');
        window.loadDashboard();
    } catch (e) { alert('Bulk Update Failed'); }
};

// =====================================================
// IMPORT SYSTEM (Excel & PDF)
// =====================================================

window.openImportModal = (file) => {
    $id('importModal').style.opacity = '1';
    $id('importModal').style.pointerEvents = 'auto';
    if (file) handleFileImport(file);
};

window.closeImportModal = () => {
    $id('importModal').style.opacity = '0';
    $id('importModal').style.pointerEvents = 'none';
    $id('modalImportFile').value = '';
    $id('importPreview').classList.add('hidden');
    $id('importErrors').classList.add('hidden');
    $id('importFileNameDisplay').textContent = 'Supports Excel (.xlsx, .xls), CSV, and PDF files';
    $id('importStatusTitle').textContent = 'Select Shipment Manifest';
    pendingImportData = [];
};

async function handleFileImport(file) {
    if (!file) return;
    const display = $id('importFileNameDisplay');
    const title = $id('importStatusTitle');
    display.textContent = `Analyzing: ${file.name}`;
    title.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing Document...';

    try {
        let data = [];
        if (file.name.toLowerCase().endsWith('.pdf')) {
            data = await parsePDF(file);
        } else {
            data = await parseExcel(file);
        }

        if (!data || data.length === 0) throw new Error('No valid shipment records identified.');

        pendingImportData = data;
        renderImportPreview(data);
        title.innerHTML = '<i class="fa-solid fa-check-circle" style="color:var(--n-success);"></i> Document Parsed';
        $id('btnExecuteImport').disabled = false;
        $id('importCount').textContent = `${data.length} records identified`;
    } catch (e) {
        console.error('[Import] Failure', e);
        title.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color:var(--n-danger);"></i> Parsing Failed';
        $id('importErrorList').innerHTML = `<li>Error: ${e.message}</li>`;
        $id('importErrors').classList.remove('hidden');
        $id('btnExecuteImport').disabled = true;
    }
}

async function parseExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
                const firstSheet = workbook.SheetNames[0];
                const raw = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: null });

                // Dynamic Header Mapping Logic
                const headers = raw.length > 0 ? Object.keys(raw[0]) : [];
                // Robust Fuzzy Mapping Logic
                const fieldMap = {
                    swbSerial: ['swb', 'serial', 'tracking', 'awb', 'number', 'waybill', 'reference', 'hwb', 'id', 'air waybill'],
                    custInvNo: ['cust inv', 'customer invoice', 'invoice no', 'inv #', 'inv no', 'bill no', 'cust ref'],
                    swbDate: ['date', 'created', 'booking date', 'manifest date', 'ship date'],
                    customer: ['customer', 'account', 'client', 'sender company', 'shipper company'],
                    shipperName: ['shipper name', 'sender name', 'from name', 'shipper'],
                    shipperPhone: ['shipper phone', 'sender phone', 'from phone', 'shipper tel'],
                    shipperAddress: ['shipper address', 'sender address', 'from address', 'shipper addr'],
                    consigneeName: ['consignee name', 'receiver name', 'to name', 'recipient', 'consignee', 'receiver'],
                    consigneePhone: ['consignee phone', 'receiver phone', 'to phone', 'recipient phone', 'consignee tel'],
                    consigneeAddress: ['consignee address', 'receiver address', 'to address', 'recipient address', 'consignee addr'],
                    consigneeCity: ['city', 'destination city', 'dest city', 'to city', 'receiver city', 'town'],
                    origQty: ['qty', 'pieces', 'pcs', 'count', 'quantity', 'units', 'packages'],
                    origWt: ['weight', 'wt', 'kg', 'kgs', 'gross weight', 'mass', 'net weight'],
                    manifestNo: ['manifest', 'bag', 'master', 'container', 'voyage', 'flight'],
                    origin: ['origin', 'from city', 'origin facility', 'pol', 'source', 'departure'],
                    destination: ['destination', 'dest facility', 'pod', 'target', 'arrival'],
                    notes: ['notes', 'remarks', 'comment', 'description', 'detail'],
                    type: ['type', 'service', 'mode', 'category', 'method'],
                    assignedTo: ['assigned', 'driver', 'agent', 'courier', 'staff'],
                    expectedDelivery: ['delivery date', 'eta', 'expected', 'due date'],
                    shippingCost: ['cost', 'price', 'amount', 'charge', 'fee'],
                    paymentStatus: ['payment', 'paid', 'billing status'],
                    originCountry: ['origin country', 'from country'],
                    destinationCountry: ['destination country', 'to country']
                };

                const dynamicMap = {};
                headers.forEach(h => {
                    const headerLower = h.toLowerCase();
                    for (const [field, keywords] of Object.entries(fieldMap)) {
                        if (keywords.some(k => headerLower.includes(k.toLowerCase()))) {
                            dynamicMap[field] = h;
                            break;
                        }
                    }
                });

                const mapped = raw.map(row => {
                    const item = {};
                    for (const [field, header] of Object.entries(dynamicMap)) {
                        item[field] = row[header];
                    }

                    // Fallbacks & Defaults
                    item.swbSerial = item.swbSerial || null;
                    item.origQty = parseInt(item.origQty) || 1;
                    item.origWt = parseFloat(item.origWt) || 0;
                    if (!item.status) item.status = 'Created';

                    return item;
                }).filter(i => i.swbSerial);

                resolve(mapped);
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsBinaryString(file);
    });
}

async function parsePDF(file) {
    const pdfLib = window['pdfjsLib'] || window.pdfjsLib;
    if (!pdfLib) throw new Error('PDF Engine (pdf.js) not loaded.');
    pdfLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(" ") + "\n";
    }

    const lines = fullText.split('\n');
    const records = [];

    // Pattern for serials: Alphanumeric with dashes, 8-20 chars
    const serialRegex = /\b([A-Z0-9-]{8,20})\b/;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const match = trimmed.match(serialRegex);
        if (match) {
            const serial = match[1];
            if (!records.find(r => r.swbSerial === serial)) {
                // Heuristic: Try to find numbers for weight/qty in the same line
                const numbers = trimmed.match(/\d+(\.\d+)?/g) || [];
                const possibleQty = numbers.find(n => parseInt(n) > 0 && parseInt(n) < 100);
                const possibleWt = numbers.find(n => parseFloat(n) > 0.1);

                records.push({
                    swbSerial: serial,
                    origQty: possibleQty ? parseInt(possibleQty) : 1,
                    origWt: possibleWt ? parseFloat(possibleWt) : 0,
                    status: 'Created',
                    notes: `Imported from PDF: ${trimmed.substring(0, 50)}...`
                });
            }
        }
    });
    return records;
}

function renderImportPreview(data) {
    const body = $id('importPreviewBody');
    if (!body) return;
    body.innerHTML = data.slice(0, 10).map(i => `
        <tr>
            <td style="color:var(--n-gold); font-weight:700;">${i.swbSerial}</td>
            <td>${i.customer || '—'}</td>
            <td>${i.shipperName || '—'}</td>
            <td>${i.consigneeName || '—'}</td>
            <td>${i.consigneeCity || '—'}</td>
        </tr>
    `).join('') + (data.length > 10 ? `<tr><td colspan="5" class="text-center text-muted">... and ${data.length - 10} more records</td></tr>` : '');
    $id('importPreview').classList.remove('hidden');
}

window.executeImport = async () => {
    const btn = $id('btnExecuteImport');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> SYNCING RECORDS...';

    try {
        const res = await getDb().bulkImportShipments(pendingImportData);
        alert(`Success: ${res.count} shipments synchronized.`);
        window.closeImportModal();
        window.loadDashboard();
        window.refreshDashboard();
    } catch (e) {
        alert('Bulk Sync Failed: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

// =====================================================
// MANIFEST MANAGEMENT
// =====================================================

let currentManifestId = null;
let currentFolderId = null;
let fmAllFiles = [];
let fmSelection = [];
let fmClipboard = { action: null, ids: [] };
let currentFileId = null;

window.loadManifests = async () => {
    const db = getDb(); if (!db) return;
    const tbody = $id('manifestTableBody'); if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-40"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading manifests...</td></tr>';
        const res = await db.getManifests();
        const items = res.data || [];

        tbody.innerHTML = items.map(m => `
            <tr>
                <td style="font-weight:800; color:var(--n-gold); cursor:pointer;" onclick="window.viewManifest('${m.manifestNo}')">${m.manifestNo}</td>
                <td>${window.nooraniUtils?.formatDate(m.manifestDate) || m.manifestDate || '—'}</td>
                <td><div style="font-size:0.85rem;"><strong>${m.origin || '—'}</strong></div><div style="font-size:0.75rem; color:var(--n-text-muted);">to ${m.destination || '—'}</div></td>
                <td>${m.totalShipments || 0}</td>
                <td>${m.totalQty || 0}</td>
                <td>${m.totalWt ? m.totalWt.toFixed(2) : '0.00'}</td>
                <td><span class="status-badge status-${(m.status || '').toLowerCase().replace(/ /g, '-')}">${m.status || 'Draft'}</span></td>
                <td class="text-right">
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button class="n-btn" title="View Workspace" onclick="window.viewManifest('${m.manifestNo}')"><i class="fa-solid fa-folder-open"></i></button>
                        <button class="n-btn" title="Edit Settings" onclick="window.showManifestForm('${m.manifestNo}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="n-btn" style="color:var(--n-danger);" title="Delete" onclick="window.deleteManifest('${m.manifestNo}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('') || `<tr><td colspan="8" class="text-center py-40 text-muted">No manifests found.</td></tr>`;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-40 text-danger">${e.message}</td></tr>`;
    }
};

window.showManifestForm = async (id) => {
    const modal = $id('manifestFormModal');
    const title = $id('manifestFormTitle');
    const form = $id('manifestEntryForm');
    form.reset();
    $id('mf-no').disabled = false;

    if (id) {
        title.textContent = 'Edit Manifest';
        try {
            const res = await getDb().getManifestById(id);
            const d = res.data;
            if (d) {
                $id('mf-no').value = d.manifestNo;
                $id('mf-no').disabled = true;
                $id('mf-date').value = d.manifestDate || '';
                $id('mf-origin').value = d.origin || '';
                $id('mf-dest').value = d.destination || '';
                $id('mf-container').value = d.containerNo || '';
                $id('mf-status').value = d.status || 'Draft';
            }
        } catch (e) { alert('Load failed'); }
    } else {
        title.textContent = 'Create Manifest';
        $id('mf-date').value = new Date().toISOString().split('T')[0];
    }

    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
};

window.closeManifestForm = () => {
    $id('manifestFormModal').style.opacity = '0';
    $id('manifestFormModal').style.pointerEvents = 'none';
};

window.saveManifest = async (e) => {
    if (e) e.preventDefault();
    const btn = $id('manifestEntryForm').querySelector('button[type="submit"]');
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> SAVING...';

    const payload = {
        manifestNo: $id('mf-no').value.trim(),
        manifestDate: $id('mf-date').value,
        origin: $id('mf-origin').value,
        destination: $id('mf-dest').value,
        containerNo: $id('mf-container').value,
        status: $id('mf-status').value
    };

    try {
        await getDb().saveManifest(payload);
        window.closeManifestForm();
        window.loadManifests();
    } catch (err) { alert('Failure: ' + err.message); }
    finally { btn.disabled = false; btn.innerHTML = originalText; }
};

$id('manifestEntryForm')?.addEventListener('submit', window.saveManifest);

window.deleteManifest = async (id) => {
    if (!confirm(`Are you sure you want to delete manifest ${id}?`)) return;
    try {
        await getDb().deleteManifest(id);
        window.loadManifests();
    } catch (e) { alert('Delete failed: ' + e.message); }
};

window.filterManifests = () => {
    const search = $id('manifestSearch').value.toLowerCase();
    const status = $id('manifestStatusFilter').value;
    const rows = document.querySelectorAll('#manifestTableBody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const rowStatus = row.querySelector('.status-badge').textContent;
        const matchesSearch = text.includes(search);
        const matchesStatus = !status || rowStatus === status;
        row.style.display = (matchesSearch && matchesStatus) ? '' : 'none';
    });
};

window.viewManifest = async (id) => {
    currentManifestId = id;
    const db = getDb(); if (!db) return;
    try {
        const res = await db.getManifestById(id);
        const d = res.data;
        if (!d) return;

        $id('mw-title').textContent = d.manifestNo;
        $id('mw-status').textContent = d.status || 'Draft';
        $id('mw-origin').textContent = d.origin || '—';
        $id('mw-destination').textContent = d.destination || '—';
        $id('mw-container').textContent = d.containerNo || 'NONE';
        $id('mw-date').textContent = window.nooraniUtils?.formatDate(d.manifestDate) || d.manifestDate || '—';

        // Stats
        const shipments = d.shipments || [];
        $id('mw-stat-count').textContent = shipments.length;
        $id('mw-stat-qty').textContent = shipments.reduce((s, r) => s + (r.origQty || 0), 0);
        $id('mw-stat-wt').textContent = shipments.reduce((s, r) => s + (r.origWt || 0), 0).toFixed(2);

        window.loadManifestShipments(id);
        window.loadManifestFiles(id);

        $id('manifestWorkspaceModal').style.opacity = '1';
        $id('manifestWorkspaceModal').style.pointerEvents = 'auto';
    } catch (e) { alert('View Failed: ' + e.message); }
};

window.closeManifestWorkspace = () => {
    $id('manifestWorkspaceModal').style.opacity = '0';
    $id('manifestWorkspaceModal').style.pointerEvents = 'none';
};

window.switchManifestTab = (tab, btn) => {
    document.querySelectorAll('.workspace-tabs .tab-item').forEach(i => i.classList.remove('active'));
    btn.classList.add('active');
    $id('mw-tab-shipments').classList.toggle('hidden', tab !== 'shipments');
    $id('mw-tab-files').classList.toggle('hidden', tab !== 'files');
};

window.loadManifestShipments = async (id) => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.getManifestById(id);
        const items = res.data?.shipments || [];
        const tbody = $id('mwShipmentTableBody');
        if (!tbody) return;
        tbody.innerHTML = items.map(s => `
            <tr>
                <td style="font-weight:700; color:var(--n-gold);">${s.swbSerial}</td>
                <td>${s.customer || '—'}</td>
                <td>${s.consigneeName || '—'}</td>
                <td>${s.consigneeCity || '—'}</td>
                <td>${s.origQty || 0}</td>
                <td>${s.origWt || 0}</td>
                <td><span class="status-badge status-${(s.status || '').toLowerCase().replace(/ /g, '-')}">${s.status || 'Created'}</span></td>
            </tr>
        `).join('') || '<tr><td colspan="7" class="text-center text-muted">No shipments assigned to this manifest.</td></tr>';
    } catch (e) { console.error('Shipments failed', e); }
};

window.editCurrentManifest = () => {
    if (currentManifestId) window.showManifestForm(currentManifestId);
};

window.exportManifestData = () => {
    alert('PDF Generation Engine Initializing...');
    // Logic for printing would go here
};

// =====================================================
// FILE MANAGER
// =====================================================

window.loadManifestFiles = async (id) => {
    try {
        const res = await getDb().getManifestFiles(id);
        fmAllFiles = res.data || [];
        currentFolderId = null;
        fmSelection = [];
        window.renderFileManager(null);
    } catch (e) { console.error('Files failed', e); }
};

window.renderFileManager = (parentId) => {
    currentFolderId = parentId;
    const container = $id('fm-grid-view');
    if (!container) return;

    const search = $id('fm-search')?.value?.toLowerCase() || '';

    // If searching, show all files in manifest, otherwise just current folder
    const items = search
        ? fmAllFiles.filter(f => f.name.toLowerCase().includes(search))
        : fmAllFiles.filter(f => f.parent_id == parentId);

    $id('fm-bulk-ops').classList.add('hidden');
    fmSelection = [];

    // Breadcrumb
    const bc = $id('fm-breadcrumb');
    let bcHtml = `<span style="cursor:pointer; ${!parentId ? 'color:var(--n-gold);' : ''}" onclick="window.renderFileManager(null)">ROOT</span>`;
    if (parentId) {
        let curr = fmAllFiles.find(f => f.id === parentId);
        let path = [];
        while(curr) {
            path.unshift(curr);
            curr = fmAllFiles.find(f => f.id === curr.parent_id);
        }
        path.forEach(p => {
            bcHtml += ` <i class="fa-solid fa-chevron-right" style="font-size:0.6rem; margin:0 4px; opacity:0.5;"></i> <span style="cursor:pointer; color:var(--n-gold);" onclick="window.renderFileManager(${p.id})">${p.name}</span>`;
        });
    }
    bc.innerHTML = bcHtml;

    container.innerHTML = items.map(f => {
        const icon = f.type === 'folder' ? 'fa-folder' : (f.mime_type?.startsWith('image/') ? 'fa-file-image' : 'fa-file-lines');
        const color = f.type === 'folder' ? 'var(--n-gold)' : 'var(--n-text-muted)';
        return `
            <div class="fm-item ${fmSelection.includes(f.id) ? 'selected' : ''}" id="fm-item-${f.id}" onclick="window.fmToggleSelect(${f.id}, event)" ondblclick="window.fmOpenItem(${f.id})">
                <div class="fm-checkbox"></div>
                <div class="fm-icon" style="color:${color};"><i class="fa-solid ${icon}"></i></div>
                <div class="fm-name" title="${f.name}">${f.name}</div>
                <div class="fm-meta">${f.type === 'folder' ? 'Folder' : window.nooraniUtils?.formatSize(f.size) || (f.size + ' B')}</div>
            </div>
        `;
    }).join('') || '<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--n-text-muted);">Folder is empty.</div>';
};

window.fmGoBack = () => {
    if (!currentFolderId) return;
    const parent = fmAllFiles.find(f => f.id === currentFolderId);
    window.renderFileManager(parent ? parent.parent_id : null);
};

window.fmOpenItem = (id) => {
    const f = fmAllFiles.find(i => i.id === id);
    if (!f) return;
    if (f.type === 'folder') window.renderFileManager(f.id);
    else window.fmOpenFile(f.id);
};

window.fmToggleSelect = (id, e) => {
    if (e.target.closest('.fm-actions')) return;

    const idx = fmSelection.indexOf(id);
    if (e.ctrlKey || e.metaKey) {
        if (idx > -1) fmSelection.splice(idx, 1);
        else fmSelection.push(id);
    } else {
        fmSelection = [id];
    }

    document.querySelectorAll('.fm-item').forEach(el => {
        const fid = parseInt(el.id.replace('fm-item-', ''));
        el.classList.toggle('selected', fmSelection.includes(fid));
    });

    const ops = $id('fm-bulk-ops');
    if (fmSelection.length > 0) {
        ops.classList.remove('hidden');
        $id('fm-select-count').textContent = `${fmSelection.length} ITEMS SELECTED`;

        // Dynamic Rename handling
        let renameBtn = ops.querySelector('.rename-btn');
        if (!renameBtn) {
            renameBtn = document.createElement('button');
            renameBtn.className = 'n-btn small rename-btn';
            renameBtn.innerHTML = '<i class="fa-solid fa-pen"></i> RENAME';
            ops.querySelector('div').prepend(renameBtn);
        }
        renameBtn.onclick = () => {
            const item = fmAllFiles.find(f => f.id === fmSelection[0]);
            if (item) window.fmRename(item.id, item.name);
        };
        renameBtn.classList.toggle('hidden', fmSelection.length !== 1);
    } else {
        ops.classList.add('hidden');
    }
};

window.fmNewFolder = async () => {
    const name = prompt('Enter folder name:');
    if (!name) return;
    try {
        await getDb().createManifestFile(currentManifestId, { name, type: 'folder', parent_id: currentFolderId });
        window.loadManifestFiles(currentManifestId).then(() => window.renderFileManager(currentFolderId));
    } catch (e) { alert(e.message); }
};

window.fmNewFile = async () => {
    const name = prompt('Enter file name:');
    if (!name) return;
    try {
        await getDb().createManifestFile(currentManifestId, { name, type: 'file', parent_id: currentFolderId, content: '' });
        window.loadManifestFiles(currentManifestId).then(() => window.renderFileManager(currentFolderId));
    } catch (e) { alert(e.message); }
};

window.fmRename = async (id, oldName, e) => {
    if (e) e.stopPropagation();
    const name = prompt('Enter new name:', oldName);
    if (!name || name === oldName) return;
    try {
        await getDb().updateManifestFile(id, { name });
        window.loadManifestFiles(currentManifestId).then(() => window.renderFileManager(currentFolderId));
    } catch (e) { alert(e.message); }
};

window.fmDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (!confirm('Delete this item?')) return;
    try {
        await getDb().deleteManifestFile(id);
        window.loadManifestFiles(currentManifestId).then(() => window.renderFileManager(currentFolderId));
    } catch (e) { alert(e.message); }
};

window.fmOpenFile = (id) => {
    const f = fmAllFiles.find(i => i.id === id);
    if (!f) return;
    currentFileId = id;
    $id('fm-editor-title').textContent = f.name;
    const isImg = f.mime_type?.startsWith('image/');

    $id('fm-text-editor').classList.toggle('hidden', isImg);
    $id('fm-image-preview').classList.toggle('hidden', !isImg);
    $id('fm-save-btn').classList.toggle('hidden', isImg);

    if (isImg) {
        $id('fm-preview-img').src = f.content || ''; // Assuming base64 or URL
    } else {
        $id('fm-text-editor').value = f.content || '';
    }

    $id('fm-editor-modal').style.opacity = '1';
    $id('fm-editor-modal').style.pointerEvents = 'auto';
};

window.fmSaveFileContent = async () => {
    if (!currentFileId) return;
    const content = $id('fm-text-editor').value;
    try {
        await getDb().updateManifestFile(currentFileId, { content });
        alert('File saved.');
        window.loadManifestFiles(currentManifestId).then(() => window.renderFileManager(currentFolderId));
        window.fmCloseEditor();
    } catch (e) { alert(e.message); }
};

window.fmCloseEditor = () => {
    $id('fm-editor-modal').style.opacity = '0';
    $id('fm-editor-modal').style.pointerEvents = 'none';
    currentFileId = null;
};

window.fmHandleUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;

    for (const file of files) {
        // Read file content if text, or just name/size for simulation
        const isText = file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.csv') || file.name.endsWith('.json');
        let content = '';
        if (isText) {
            content = await file.text();
        } else if (file.type.startsWith('image/')) {
            // For demo, we might convert to base64
            content = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        }

        await getDb().createManifestFile(currentManifestId, {
            name: file.name,
            type: 'file',
            parent_id: currentFolderId,
            mime_type: file.type,
            size: file.size,
            content: content
        });
    }

    window.loadManifestFiles(currentManifestId).then(() => window.renderFileManager(currentFolderId));
    e.target.value = '';
};

window.fmBulkCopy = () => {
    if (!fmSelection.length) return;
    fmClipboard = { action: 'copy', ids: [...fmSelection] };
    $id('fm-paste-zone').classList.remove('hidden');
    // Provide visual feedback
    document.querySelectorAll('.fm-item.selected').forEach(el => el.style.opacity = '0.7');
};

window.fmBulkMove = () => {
    if (!fmSelection.length) return;
    fmClipboard = { action: 'move', ids: [...fmSelection] };
    $id('fm-paste-zone').classList.remove('hidden');
    // Provide visual feedback
    document.querySelectorAll('.fm-item.selected').forEach(el => el.style.opacity = '0.5');
};

window.fmBulkDelete = async () => {
    if (!confirm(`Delete ${fmSelection.length} items?`)) return;
    try {
        await getDb().bulkFileOperation({ ids: fmSelection, action: 'delete' });
        window.loadManifestFiles(currentManifestId).then(() => window.renderFileManager(currentFolderId));
    } catch (e) { alert(e.message); }
};

window.fmPaste = async () => {
    if (!fmClipboard.ids.length) return;
    try {
        await getDb().bulkFileOperation({
            ids: fmClipboard.ids,
            action: fmClipboard.action,
            target_parent_id: currentFolderId
        });
        window.loadManifestFiles(currentManifestId).then(() => window.renderFileManager(currentFolderId));
        $id('fm-paste-zone').classList.add('hidden');
        fmClipboard = { action: null, ids: [] };
    } catch (e) { alert(e.message); }
};

window.fmDownloadCurrentFile = () => {
    if (!currentFileId) return;
    const f = fmAllFiles.find(i => i.id === currentFileId);
    if (!f) return;

    const blob = new Blob([f.content], { type: f.mime_type || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// =====================================================
// WIRING
// =====================================================

async function init() {
    const check = setInterval(async () => {
        if (getDb()) {
            clearInterval(check);
            await getDb().waitForReady();
            window.refreshDashboard();
            window.loadDashboard();
            window.renderUsers();
            window.loadManifests();

            $id('inventorySearch')?.addEventListener('input', () => {
                clearTimeout(window.sT);
                window.sTimer = setTimeout(() => window.loadDashboard(), 300);
            });
        }
    }, 200);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

$id('inventoryImportFile')?.addEventListener('change', e => { if (e.target.files[0]) window.openImportModal(e.target.files[0]); });
$id('modalImportFile')?.addEventListener('change', e => { if (e.target.files[0]) handleFileImport(e.target.files[0]); });
