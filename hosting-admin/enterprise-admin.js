/**
 * Noorani Cargo Enterprise | Professional SWB Engine
 * Updated: 2026-08-13 (Optimized Connection & Bulk Import)
 */

import { nooraniDb } from './firebase.js';

const $id = id => document.getElementById(id);
const getDb = () => nooraniDb || window.nooraniDb;

let pendingImportData = [];

// --- Dashboard & Inventory ---

window.refreshDashboard = async () => {
    const db = getDb(); if (!db) return;
    try {
        const s = await db.getDashboardStats();
        if ($id('stat-total-swbs')) $id('stat-total-swbs').textContent = s.totalSwbs || 0;

        // Status Breakdown
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
            if (el) {
                const total = statuses.reduce((sum, st) => sum + (b[st] || 0), 0);
                el.textContent = total;
            }
        }

        // Render Recent Records in Dashboard if the container exists
        const recentTbody = $id('recentSwbTableBody');
        if (recentTbody && s.recentItems) {
            recentTbody.innerHTML = s.recentItems.map(s => `
                <tr>
                    <td style="font-weight:700; color:var(--n-gold);">${s.swbSerial}</td>
                    <td>${s.customer || '—'}</td>
                    <td><span class="status-badge status-${(s.status || '').toLowerCase().replace(' ', '-')}">${s.status || 'Created'}</span></td>
                    <td>${s.swbDate || '—'}</td>
                    <td class="text-right"><button class="n-btn" onclick="window.viewShipment('${s.swbSerial}')"><i class="fa-solid fa-eye"></i></button></td>
                </tr>
            `).join('') || '<tr><td colspan="5" class="text-center text-muted">No recent activity.</td></tr>';
        }
    } catch (e) {
        console.error('[Dashboard] Stats Error', e);
        if ($id('stat-total-swbs')) $id('stat-total-swbs').textContent = 'ERR';
    }
};

window.loadDashboard = async () => {
    const db = getDb(); if (!db) return;
    const tbody = $id('swbTableBody'); if (!tbody) return;

    // Advanced Filtering
    const filters = {
        search: $id('inventorySearch')?.value || '',
        status: $id('filterStatus')?.value || '',
        origin: $id('filterOrigin')?.value || '',
        destination: $id('filterDestination')?.value || '',
        manifestNo: $id('filterManifest')?.value || '',
        limit: 1000
    };

    try {
        console.log('[Inventory] Fetching records...');
        tbody.innerHTML = '<tr><td colspan="13" class="text-center py-40"><i class="fa-solid fa-circle-notch fa-spin"></i> Synchronizing with Global Network...</td></tr>';

        const res = await db.querySwbs(filters);
        const items = res.items || [];
        tbody.innerHTML = items.map(s => `
            <tr id="row_${s.swbSerial}">
                <td><input type="checkbox" class="swb-select" value="${s.swbSerial}"></td>
                <td style="font-weight:800; color:var(--n-gold); white-space:nowrap;" onclick="window.viewShipment('${s.swbSerial}')" class="clickable">${s.swbSerial}</td>
                <td><span class="status-badge status-${(s.status || '').toLowerCase().replace(' ', '-')}">${s.status || 'Created'}</span></td>
                <td>${s.customer || ''}</td>
                <td>${s.shipperName || ''}</td>
                <td>${s.consigneeName || ''}</td>
                <td>${s.consigneeCity || ''}</td>
                <td>${s.origQty || 0}</td>
                <td>${s.origWt || 0}</td>
                <td>${s.manifestNo || '—'}</td>
                <td>${s.swbDate || ''}</td>
                <td class="text-right">
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button class="n-btn" title="View Details" style="padding:6px 10px;" onclick="window.viewShipment('${s.swbSerial}')"><i class="fa-solid fa-file-lines"></i></button>
                        <button class="n-btn" title="Edit Record" style="padding:6px 10px;" onclick="window.editSwb('${s.swbSerial}')"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="n-btn" title="Delete Record" style="padding:6px 10px; color:var(--n-danger);" onclick="window.deleteSwb('${s.swbSerial}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('') || `<tr><td colspan="13" class="text-center py-40 text-muted">No shipments matched your criteria.</td></tr>`;
    } catch (e) {
        console.error('[Inventory] Load Error:', e);
        tbody.innerHTML = `<tr><td colspan="13" class="text-center py-40 text-danger">
            <i class="fa-solid fa-triangle-exclamation"></i><br>
            <strong>Operational Failure</strong><br>
            <span style="font-size:0.8rem;">${e.message}</span>
        </td></tr>`;
    }
};

// Export to Excel
window.exportToExcel = async () => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.querySwbs({ limit: 5000 });
        const items = res.items || [];
        if (!items.length) return alert('No data to export.');

        const data = items.map(s => ({
            'SWB Serial No.': s.swbSerial,
            'Cust. Inv. No.': s.custInvNo,
            'SWB Date': s.swbDate,
            'Customer': s.customer,
            'Customer Inv. No.': s.customerInvNo,
            'Shipper Name': s.shipperName,
            'Consignee Name': s.consigneeName,
            'Orig. Qty': s.origQty,
            'Orig. Wt.': s.origWt,
            'Consignee City': s.consigneeCity,
            'Consignee Address': s.consigneeAddress
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "SWB Inventory");
        XLSX.writeFile(wb, `Noorani_Cargo_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
        alert('Export Failed: ' + e.message);
    }
};

// --- SWB CRUD ---

window.resetSwbForm = () => {
    const fields = ['swbSerial', 'custInvNo', 'customerInvNo', 'swbDate', 'customer', 'shipperName', 'consigneeName', 'swbOrigin', 'swbDestination', 'consigneeCity', 'origQty', 'origWt', 'expectedDelivery', 'consigneeAddress', 'swbNotes'];
    fields.forEach(f => { if ($id(f)) $id(f).value = ''; });
};

window.saveSwb = async (e) => {
    const db = getDb(); if (!db) return;
    const btn = (e && e.target) ? e.target.closest('button') : $id('btnSaveSwb');
    const originalText = btn ? btn.innerHTML : '';

    const id = $id('swbSerial').value.trim();
    if (!id) return alert('Critical: SWB Serial No. is required.');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> SYNCHRONIZING...';
    }

    const actorEmail = window.nooraniAdminUser?.email || 'admin';

    const d = {
        custInvNo: $id('custInvNo').value,
        swbDate: $id('swbDate').value,
        customer: $id('customer').value,
        customerInvNo: $id('customerInvNo').value,
        shipperName: $id('shipperName').value,
        consigneeName: $id('consigneeName').value,
        origQty: parseInt($id('origQty').value) || 0,
        origWt: parseFloat($id('origWt').value) || 0,
        consigneeCity: $id('consigneeCity').value,
        consigneeAddress: $id('consigneeAddress').value,
        status: $id('swbStatus')?.value || 'Created',
        origin: $id('swbOrigin')?.value || '',
        destination: $id('swbDestination')?.value || '',
        expectedDelivery: $id('expectedDelivery')?.value || '',
        notes: $id('swbNotes')?.value || '',
        actorEmail
    };

    try {
        await db.saveSwb(id, d);
        alert(`Success: Shipment ${id} operational record updated.`);

        // Redirect to inventory to show the new record
        history.pushState(null, '', '?page=swb-management');
        window.dispatchEvent(new Event('popstate'));
    } catch (err) {
        alert('Operational Failure: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};

window.viewShipment = async id => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.getSwbBySerial(id);
        const history = await db.getSwbHistory(id);
        const d = res.data;

        const m = $id('shipmentWorkspaceModal');
        if (!m) return;

        $id('ws-serial').textContent = d.swbSerial;
        $id('ws-status-badge').className = `status-badge status-${(d.status || '').toLowerCase().replace(' ', '-')}`;
        $id('ws-status-badge').textContent = d.status || 'Created';

        $id('ws-customer').textContent = d.customer || '—';
        $id('ws-shipper').textContent = d.shipperName || '—';
        $id('ws-consignee').textContent = d.consigneeName || '—';
        $id('ws-origin').textContent = d.origin || '—';
        $id('ws-destination').textContent = d.destination || '—';
        $id('ws-qty').textContent = d.origQty || '0';
        $id('ws-wt').textContent = d.origWt || '0';
        $id('ws-manifest').textContent = d.manifestNo || 'NONE';

        // Timeline
        const timeline = $id('ws-timeline');
        timeline.innerHTML = (history || []).map(h => `
            <div class="timeline-item">
                <div class="timeline-point"></div>
                <div class="timeline-content">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${h.status}</strong>
                        <span class="text-muted" style="font-size:0.7rem;">${new Date(h.created_at).toLocaleString()}</span>
                    </div>
                    <p style="font-size:0.8rem; margin-top:4px;">${h.remarks || ''}</p>
                    <div style="font-size:0.65rem; color:var(--n-gold); margin-top:4px;">Updated by: ${h.actorEmail}</div>
                </div>
            </div>
        `).join('') || '<p class="text-center text-muted py-20">No history identified.</p>';

        m.style.opacity = '1'; m.style.pointerEvents = 'auto';
    } catch (e) { alert('Failed to load shipment workspace.'); }
};

window.closeShipmentWorkspace = () => {
    $id('shipmentWorkspaceModal').style.opacity = '0';
    $id('shipmentWorkspaceModal').style.pointerEvents = 'none';
};

window.updateBulkStatus = async () => {
    const status = $id('bulkStatusSelect').value;
    if (!status) return alert('Select a professional status.');

    const selected = Array.from(document.querySelectorAll('.swb-select:checked')).map(cb => cb.value);
    if (!selected.length) return alert('No shipments selected.');

    if (!confirm(`Update ${selected.length} shipments to ${status}?`)) return;

    const db = getDb();
    try {
        await db.bulkUpdateStatus(selected, status, 'Bulk update via Operations');
        alert('Mission Success: Bulk operational update complete.');
        window.loadDashboard();
    } catch (e) { alert('Bulk Update Failed: ' + e.message); }
};

window.editSwb = async id => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.getSwbBySerial(id);
        const d = res.data;
        $id('swbSerial').value = d.swbSerial;
        $id('custInvNo').value = d.custInvNo || '';
        $id('customerInvNo').value = d.customerInvNo || '';
        $id('swbDate').value = d.swbDate || '';
        $id('customer').value = d.customer || '';
        $id('shipperName').value = d.shipperName || '';
        $id('consigneeName').value = d.consigneeName || '';
        $id('swbOrigin').value = d.origin || '';
        $id('swbDestination').value = d.destination || '';
        $id('consigneeCity').value = d.consigneeCity || '';
        $id('swbStatus').value = d.status || 'Created';
        $id('origQty').value = d.origQty || '';
        $id('origWt').value = d.origWt || '';
        $id('expectedDelivery').value = d.expectedDelivery || '';
        $id('consigneeAddress').value = d.consigneeAddress || '';
        $id('swbNotes').value = d.notes || '';

        history.pushState(null, '', '?page=create-swb');
        window.dispatchEvent(new Event('popstate'));
    } catch (e) { alert('Load Failure'); }
};

window.printShipment = () => {
    window.print();
};

window.deleteSwb = async id => {
    if (confirm('Irreversible: Permanently remove this SWB record?')) {
        const db = getDb(); if (!db) return;
        try {
            await db.deleteSwb(id);
            window.loadDashboard();
            window.refreshDashboard();
        } catch (e) { alert('Deletion Failure'); }
    }
};

// --- Real SWB Import Logic ---

window.openImportModal = (file = null) => {
    const m = $id('importModal');
    if (!m) return;
    m.style.opacity = '1'; m.style.pointerEvents = 'auto';

    // Reset modal UI
    $id('importPreview').classList.add('hidden');
    $id('importErrors').classList.add('hidden');
    $id('importCount').textContent = '0 records identified';
    $id('btnExecuteImport').disabled = true;
    $id('importStatusTitle').textContent = 'Select SWB Manifest';
    $id('importFileNameDisplay').textContent = 'Supports Excel (.xlsx, .xls), CSV, and PDF';
    if ($id('modalImportFile')) $id('modalImportFile').value = '';

    if (file) handleFileImport(file);
};

window.closeImportModal = () => {
    const m = $id('importModal');
    m.style.opacity = '0'; m.style.pointerEvents = 'none';
};

const handleFileImport = (file) => {
    if (!file) return;
    $id('importFileNameDisplay').textContent = `File: ${file.name}`;
    $id('importStatusTitle').textContent = 'Analyzing Aramex-Style Manifest...';

    const reader = new FileReader();
    const extension = file.name.split('.').pop().toLowerCase();

    reader.onload = async (evt) => {
        try {
            let rows = [];
            if (extension === 'pdf') {
                rows = await parsePdf(evt.target.result);
            } else {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            }

            if (!rows || rows.length < 1) throw new Error('File appears to be empty or unreadable.');

            // Advanced Header Detection
            let headerIdx = rows.findIndex(r => r.some(c => String(c || '').toLowerCase().includes('serial') || String(c || '').toLowerCase().includes('awb') || String(c || '').toLowerCase().includes('swb')));
            if (headerIdx === -1) headerIdx = 0;

            const rawHeaders = rows[headerIdx];
            const headers = rawHeaders.map(h => String(h || '').toLowerCase().trim());

            const mappingSchema = {
                swbSerial: ['swb serial', 'serial no', 'swb no', 'awb', 'hawb', 'reference', 'tracking', 'serial', 'awb #'],
                custInvNo: ['cust. inv. no', 'cust inv no', 'customer invoice number', 'reference 1', 'ref 1', 'customer ref'],
                swbDate: ['swb date', 'date', 'created at', 'ship date', 'date of booking'],
                customer: ['customer name', 'client', 'customer', 'account', 'shipper name'],
                customerInvNo: ['customer inv. no', 'customer invoice no', 'reference 2', 'ref 2', 'inv no'],
                shipperName: ['shipper name', 'shipper', 'sender', 'from', 'shipper'],
                consigneeName: ['consignee name', 'consignee', 'receiver', 'to', 'recipient', 'consignee'],
                origQty: ['orig. qty', 'orig qty', 'quantity', 'pieces', 'pkgs', 'count', 'qty', 'total pkgs', 'qty (pcs)'],
                origWt: ['orig. wt', 'orig wt', 'weight', 'gross weight', 'actual weight', 'wt', 'chargeable weight'],
                consigneeCity: ['consignee city', 'city', 'destination city', 'recipient city', 'dest', 'dest. city'],
                consigneeAddress: ['consignee address', 'address', 'recipient address', 'destination address', 'consignee address'],
                origin: ['origin', 'origin hub', 'source', 'departure'],
                destination: ['destination', 'dest hub', 'arrival hub'],
                status: ['status', 'current status', 'shipment status'],
                manifestNo: ['manifest', 'manifest no', 'runsheet', 'bag no'],
                notes: ['notes', 'remarks', 'description', 'comments']
            };

            const colMap = {};
            const unmapped = [];
            const mappedInfo = [];

            Object.entries(mappingSchema).forEach(([dbField, variations]) => {
                // Try exact match first
                let idx = headers.findIndex(h => variations.some(v => h === v));

                // If no exact match, try "starts with" or "contains" with word boundary
                if (idx === -1) {
                    idx = headers.findIndex(h => variations.some(v => {
                        if (v.length <= 3) return h === v; // Too short for fuzzy
                        return h.includes(v);
                    }));
                }

                if (idx !== -1 && !Object.values(colMap).includes(idx)) {
                    colMap[dbField] = idx;
                    mappedInfo.push({ field: dbField, col: rawHeaders[idx] });
                }
            });

            headers.forEach((h, i) => {
                if (!Object.values(colMap).includes(i)) unmapped.push(rawHeaders[i]);
            });

            // Update UI with mapping results
            const mappingSummary = $id('importMappingSummary');
            if (mappingSummary) {
                mappingSummary.innerHTML = `
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:0.75rem; margin-bottom:20px;">
                        <div class="n-card" style="margin:0; padding:12px; background:rgba(26, 188, 156, 0.1); border-color:var(--n-success);">
                            <strong style="color:var(--n-success);"><i class="fa-solid fa-check-circle"></i> Mapped (${mappedInfo.length})</strong>
                            <div style="margin-top:8px; opacity:0.8;">${mappedInfo.map(m => `<div>${m.field} &larr; ${m.col}</div>`).join('')}</div>
                        </div>
                        <div class="n-card" style="margin:0; padding:12px; background:rgba(192, 57, 43, 0.1); border-color:var(--n-danger);">
                            <strong style="color:var(--n-danger);"><i class="fa-solid fa-triangle-exclamation"></i> Unmapped (${unmapped.length})</strong>
                            <div style="margin-top:8px; opacity:0.8;">${unmapped.join(', ') || 'None'}</div>
                        </div>
                    </div>
                `;
            }

            const errors = [];
            const duplicateCheck = new Set();
            const now = new Date().toISOString().split('T')[0];

            pendingImportData = rows.slice(headerIdx + 1).map((row, idx) => {
                if (!row || !row.length || !row.some(c => c)) return null;
                const get = (k) => colMap[k] !== undefined ? String(row[colMap[k]] || '').trim() : '';

                const swbSerial = get('swbSerial');
                if (!swbSerial || swbSerial === 'null' || swbSerial === 'undefined') {
                    // Skip empty rows silently, but log real missing serials
                    if (row.some(c => c)) errors.push(`Row ${idx + 2}: Missing primary Serial/AWB`);
                    return null;
                }

                if (duplicateCheck.has(swbSerial)) {
                    errors.push(`Row ${idx + 2}: Duplicate Serial ${swbSerial} in file`);
                    return null;
                }
                duplicateCheck.add(swbSerial);

                // Robust Date Parsing for Excel
                let rawDate = get('swbDate');
                let finalDate = now;
                if (rawDate) {
                    try {
                        // Check if it's an Excel serial number
                        if (!isNaN(rawDate) && Number(rawDate) > 40000) {
                            const dateObj = XLSX.SSF.parse_date_code(Number(rawDate));
                            finalDate = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
                        } else {
                            const d = new Date(rawDate);
                            if (!isNaN(d.getTime())) finalDate = d.toISOString().split('T')[0];
                        }
                    } catch(e) { console.warn('Date parse failed for:', rawDate); }
                }

                return {
                    swbSerial,
                    custInvNo: get('custInvNo'),
                    swbDate: finalDate,
                    customer: get('customer'),
                    customerInvNo: get('customerInvNo'),
                    shipperName: get('shipperName'),
                    consigneeName: get('consigneeName'),
                    origQty: parseInt(get('origQty')) || 0,
                    origWt: parseFloat(get('origWt')) || 0,
                    consigneeCity: get('consigneeCity'),
                    consigneeAddress: get('consigneeAddress'),
                    origin: get('origin'),
                    destination: get('destination'),
                    status: get('status') || 'Created',
                    manifestNo: get('manifestNo'),
                    notes: get('notes')
                };
            }).filter(Boolean);

            if (errors.length) {
                $id('importErrorList').innerHTML = errors.map(e => `<li>${e}</li>`).join('');
                $id('importErrors').classList.remove('hidden');
            } else {
                $id('importErrors').classList.add('hidden');
            }

            $id('importPreviewBody').innerHTML = pendingImportData.slice(0, 5).map(s => `
                <tr>
                    <td><strong style="color:var(--n-gold);">${s.swbSerial}</strong></td>
                    <td>${s.customer || '—'}</td>
                    <td>${s.shipperName || '—'}</td>
                    <td>${s.consigneeName || '—'}</td>
                    <td>${s.consigneeCity || '—'}</td>
                </tr>
            `).join('');

            $id('importPreview').classList.remove('hidden');
            $id('importCount').textContent = `${pendingImportData.length} Valid Records Ready`;
            $id('btnExecuteImport').disabled = pendingImportData.length === 0;
            $id('importStatusTitle').textContent = 'Intelligence Analysis Complete';

        } catch (err) {
            console.error('[Import Error]', err);
            alert('Mission Failure: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
};

const parsePdf = async (buffer) => {
    try {
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        let allRows = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Group items by Y coordinate to detect rows
            const yGroups = {};
            textContent.items.forEach(item => {
                const y = Math.round(item.transform[5]);
                if (!yGroups[y]) yGroups[y] = [];
                yGroups[y].push(item);
            });

            // Sort Y coordinates descending (top to bottom)
            const sortedY = Object.keys(yGroups).sort((a, b) => b - a);

            sortedY.forEach(y => {
                const rowItems = yGroups[y].sort((a, b) => a.transform[4] - b.transform[4]);
                allRows.push(rowItems.map(item => item.str));
            });
        }
        return allRows;
    } catch (e) {
        console.error('PDF Parse Error', e);
        throw new Error('Could not parse PDF table structure.');
    }
};

// Event Listeners for File Selection
$id('inventoryImportFile')?.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        window.openImportModal(e.target.files[0]);
        e.target.value = '';
    }
});

$id('modalImportFile')?.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFileImport(e.target.files[0]);
});

// Configure PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

window.executeImport = async () => {
    const db = getDb(); if (!db) return;
    const btn = $id('btnExecuteImport');
    const originalText = btn.textContent;
    btn.disabled = true;

    let success = 0;
    let failed = 0;
    const total = pendingImportData.length;

    try {
        for (let i = 0; i < total; i++) {
            const item = pendingImportData[i];
            btn.textContent = `IMPORTING (${i + 1}/${total})...`;
            try {
                await db.saveSwb(item.swbSerial, item);
                success++;
            } catch (err) {
                console.error(`Failed to import ${item.swbSerial}`, err);
                failed++;
            }
        }

        // Show success state in button before alert
        btn.style.background = 'var(--n-success)';
        btn.textContent = 'MISSION ACCOMPLISHED';

        alert(`Mission Complete:\n- ${success} Shipments Synchronized\n- ${failed} Failed Records`);

        window.closeImportModal();

        // Ensure UI refreshes
        if (window.loadDashboard) await window.loadDashboard();
        if (window.refreshDashboard) await window.refreshDashboard();
    } catch (e) {
        alert(`Critical Import Failure: ${e.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
};

// --- User Management ---

window.renderUsers = async () => {
    const db = getDb(); if (!db) return;
    try {
        const users = await db.getUserAccounts();
        $id('userTableBody').innerHTML = (users || []).map(u => `
            <tr>
                <td><div style="display:flex; align-items:center; gap:12px;"><div style="width:32px; height:32px; background:var(--n-gold-glow); border-radius:50%; display:grid; place-items:center; color:var(--n-gold); font-weight:900;">${u.email.charAt(0).toUpperCase()}</div><strong>${u.email}</strong></div></td>
                <td><span class="status-badge">${u.role.toUpperCase()}</span></td>
                <td><span class="status-badge status-delivered">ACTIVE</span></td>
                <td class="text-right">
                    <button class="n-btn" style="color:var(--n-danger); border-color:rgba(192, 57, 43, 0.2);" onclick="window.deleteUser('${u.uid}')"><i class="fa-solid fa-user-xmark"></i></button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="4" class="text-center py-20 text-muted">No accounts identified.</td></tr>';
    } catch (e) { console.error('[Users] Render Error', e); }
};

window.showUserForm = () => {
    $id('userEntryForm').reset();
    $id('userFormModal').style.opacity = '1';
    $id('userFormModal').style.pointerEvents = 'auto';
};

window.closeUserForm = () => {
    $id('userFormModal').style.opacity = '0';
    $id('userFormModal').style.pointerEvents = 'none';
};

window.submitUserForm = async () => {
    const db = getDb(); if (!db) return;
    const email = $id('user-email').value;
    const pass = $id('user-pass').value;
    const role = $id('user-role').value;

    if (!email || !pass) return alert('Email and Access Token are required.');

    try {
        await db.saveUserAccount({ email, password: pass, role });
        alert('User Authorization Complete.');
        window.closeUserForm();
        window.renderUsers();
    } catch (e) { alert('Authorization Failure: ' + e.message); }
};

window.deleteUser = async uid => {
    if (confirm('Revoke access for this user permanently?')) {
        const db = getDb(); if (!db) return;
        try { await db.deleteUserAccount(uid); window.renderUsers(); } catch(e){ alert('Deletion Failure'); }
    }
};

// --- Manifest Logic ---

window.loadManifests = async () => {
    const db = getDb(); if (!db) return;
    const tbody = $id('manifestTableBody'); if (!tbody) return;
    try {
        const data = await db.getManifests();
        tbody.innerHTML = (data || []).map(m => `
            <tr>
                <td style="font-weight:700; color:var(--n-gold);">${m.manifestNo}</td>
                <td>${m.date || ''}</td>
                <td>${m.origin || ''}</td>
                <td>${m.destination || ''}</td>
                <td>${m.containerNo || ''}</td>
                <td><span class="status-badge">${m.status || 'Draft'}</span></td>
                <td class="text-right">
                    <button class="n-btn" onclick="window.viewManifest('${m.manifestNo}')"><i class="fa-solid fa-eye"></i></button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="7" class="text-center text-muted">No manifests identified.</td></tr>';
    } catch (e) { console.error('[Manifests] Load Error', e); }
};

window.showManifestForm = () => {
    const no = 'MNF-' + Date.now();
    const manifest = {
        manifestNo: no,
        date: new Date().toISOString().split('T')[0],
        status: 'Draft',
        created_by: window.nooraniAdminUser?.email || 'admin'
    };
    if (confirm(`Initialize new manifest ${no}?`)) {
        getDb().saveManifest(manifest).then(() => window.loadManifests());
    }
};

window.viewManifest = (manifestNo) => {
    // Switch to inventory page and set manifest filter
    history.pushState(null, '', `?page=swb-management&manifest=${manifestNo}`);
    const filterInput = $id('filterManifest');
    if (filterInput) filterInput.value = manifestNo;
    window.loadDashboard();

    // Smooth scroll to inventory
    const section = $id('swbManagementSection');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
};

// --- Initialization ---

async function init() {
    const checkDb = setInterval(async () => {
        const db = getDb();
        if (db && db.waitForReady) {
            clearInterval(checkDb);
            await db.waitForReady();
            window.loadDashboard();
            window.refreshDashboard();
            window.renderUsers();
            window.loadManifests();

            // Setup Search Listener with debounce
            let searchTimer;
            $id('inventorySearch')?.addEventListener('input', (e) => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => window.loadDashboard(), 300);
            });

            window.addEventListener('popstate', () => {
                const p = new URLSearchParams(window.location.search).get('page');
                if (p === 'swb-management') window.loadDashboard();
                else if (p === 'dashboard') window.refreshDashboard();
                else if (p === 'user-management') window.renderUsers();
                else if (p === 'manifests') window.loadManifests();
            });
        }
    }, 200);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
