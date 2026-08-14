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
                <td style="font-weight:800; color:var(--n-gold); cursor:pointer;" onclick="window.viewShipment('${s.swbSerial}')">${s.swbSerial}</td>
                <td><span class="status-badge status-${(s.status || '').toLowerCase().replace(/ /g, '-')}">${s.status || 'Created'}</span></td>
                <td>${s.customer || ''}</td>
                <td>${s.shipperName || ''}</td>
                <td>${s.consigneeName || ''}</td>
                <td>${s.origin || '—'}</td>
                <td>${s.consigneeCity || ''}</td>
                <td>${s.origQty || 0}</td>
                <td>${s.origWt || 0}</td>
                <td>${s.manifestNo || '—'}</td>
                <td>${window.nooraniUtils?.formatDate(s.swbDate) || s.swbDate || ''}</td>
                <td class="text-right">
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button class="n-btn" title="View" onclick="window.viewShipment('${s.swbSerial}')"><i class="fa-solid fa-eye"></i></button>
                        <button class="n-btn" title="Edit" onclick="window.editShipment('${s.swbSerial}')"><i class="fa-solid fa-pen"></i></button>
                    </div>
                </td>
            </tr>
        `).join('') || `<tr><td colspan="14" class="text-center py-40 text-muted">No records found.</td></tr>`;
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

                const mapped = raw.map(row => {
                    const find = (keys) => {
                        const k = Object.keys(row).find(rk => keys.some(sk => rk.toLowerCase().includes(sk.toLowerCase())));
                        return k ? row[k] : null;
                    };
                    return {
                        swbSerial: find(['swb', 'serial', 'tracking', 'awb', 'number']),
                        customer: find(['customer', 'account', 'client']),
                        shipperName: find(['shipper', 'sender']),
                        shipperPhone: find(['shipper phone', 'sender phone']),
                        shipperAddress: find(['shipper address', 'sender address']),
                        consigneeName: find(['consignee', 'receiver']),
                        consigneePhone: find(['consignee phone', 'receiver phone']),
                        consigneeAddress: find(['consignee address', 'receiver address']),
                        consigneeCity: find(['city', 'destination city', 'dest city']),
                        origQty: parseInt(find(['qty', 'pieces', 'pcs'])) || 1,
                        origWt: parseFloat(find(['weight', 'wt', 'kg'])) || 0,
                        swbDate: find(['date', 'created']),
                        manifestNo: find(['manifest']),
                        origin: find(['origin', 'origin facility']),
                        destination: find(['destination', 'destination facility']),
                        notes: find(['notes', 'remarks'])
                    };
                }).filter(i => i.swbSerial);
                resolve(mapped);
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsBinaryString(file);
    });
}

async function parsePDF(file) {
    // Ensure pdfjsLib is available and worker is configured
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

    // Advanced Regex for Serial Numbers (e.g., NC-2026-XXXX or standard alphanumeric)
    const lines = fullText.split('\n');
    const records = [];
    const serialRegex = /\b([A-Z0-9-]{8,20})\b/g;

    lines.forEach(line => {
        const matches = line.match(serialRegex);
        if (matches) {
            matches.forEach(serial => {
                if (!records.find(r => r.swbSerial === serial)) {
                    records.push({
                        swbSerial: serial,
                        status: 'Created',
                        notes: 'Imported from PDF manifest'
                    });
                }
            });
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
