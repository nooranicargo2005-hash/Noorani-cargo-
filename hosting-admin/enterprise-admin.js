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

        // Render Recent Records in Dashboard if the container exists
        const recentTbody = $id('recentSwbTableBody');
        if (recentTbody && s.recentItems) {
            recentTbody.innerHTML = s.recentItems.map(s => `
                <tr>
                    <td style="font-weight:700; color:var(--n-gold);">${s.swbSerial}</td>
                    <td>${s.customer || '—'}</td>
                    <td>${s.consigneeName || '—'}</td>
                    <td>${s.swbDate || '—'}</td>
                    <td class="text-right"><button class="n-btn" onclick="window.editSwb('${s.swbSerial}')"><i class="fa-solid fa-eye"></i></button></td>
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

    // Check if there is a search query
    const search = $id('inventorySearch')?.value || '';

    try {
        console.log('[Inventory] Fetching records...');
        tbody.innerHTML = '<tr><td colspan="12" class="text-center py-40"><i class="fa-solid fa-circle-notch fa-spin"></i> Synchronizing with Database...</td></tr>';

        const res = await db.querySwbs({ search, limit: 1000 });
        const items = res.items || [];
        tbody.innerHTML = items.map(s => `
            <tr id="row_${s.swbSerial}">
                <td style="font-weight:800; color:var(--n-gold); white-space:nowrap;">${s.swbSerial}</td>
                <td>${s.custInvNo || ''}</td>
                <td>${s.swbDate || ''}</td>
                <td>${s.customer || ''}</td>
                <td>${s.customerInvNo || ''}</td>
                <td>${s.shipperName || ''}</td>
                <td>${s.consigneeName || ''}</td>
                <td>${s.origQty || 0}</td>
                <td>${s.origWt || 0}</td>
                <td>${s.consigneeCity || ''}</td>
                <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${s.consigneeAddress || ''}">${s.consigneeAddress || ''}</td>
                <td class="text-right">
                    <div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button class="n-btn" title="Edit Record" style="padding:6px 10px;" onclick="window.editSwb('${s.swbSerial}')"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="n-btn" title="Delete Record" style="padding:6px 10px; color:var(--n-danger);" onclick="window.deleteSwb('${s.swbSerial}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('') || `<tr><td colspan="12" class="text-center py-40 text-muted">No records found ${search ? `for "${search}"` : ''}.</td></tr>`;
    } catch (e) {
        console.error('[Inventory] Load Error:', e);
        tbody.innerHTML = `<tr><td colspan="12" class="text-center py-40 text-danger">
            <i class="fa-solid fa-triangle-exclamation"></i><br>
            <strong>Connection Failed</strong><br>
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
    const fields = ['swbSerial', 'custInvNo', 'swbDate', 'customer', 'customerInvNo', 'shipperName', 'consigneeName', 'origQty', 'origWt', 'consigneeCity', 'consigneeAddress'];
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
        consigneeAddress: $id('consigneeAddress').value
    };

    try {
        await db.saveSwb(id, d);
        alert(`Success: SWB ${id} has been permanently saved to the database.`);

        // Redirect to inventory to show the new record
        history.pushState(null, '', '?page=swb-management');
        window.dispatchEvent(new Event('popstate'));
    } catch (err) {
        alert('Synchronization Failed: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};

window.editSwb = async id => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.getSwbBySerial(id);
        const d = res.data;
        $id('swbSerial').value = d.swbSerial;
        $id('custInvNo').value = d.custInvNo || '';
        $id('swbDate').value = d.swbDate || '';
        $id('customer').value = d.customer || '';
        $id('customerInvNo').value = d.customerInvNo || '';
        $id('shipperName').value = d.shipperName || '';
        $id('consigneeName').value = d.consigneeName || '';
        $id('origQty').value = d.origQty || '';
        $id('origWt').value = d.origWt || '';
        $id('consigneeCity').value = d.consigneeCity || '';
        $id('consigneeAddress').value = d.consigneeAddress || '';

        history.pushState(null, '', '?page=create-swb');
        window.dispatchEvent(new Event('popstate'));
    } catch (e) { alert('Load Failure'); }
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
    $id('importFileNameDisplay').textContent = 'Supports Excel (.xlsx, .xls) and CSV files';
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
    $id('importStatusTitle').textContent = 'Reading Manifest...';

    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            if (rows.length < 2) throw new Error('File appears to be empty.');

            // Column Mapping (Robust mapping for 11 professional fields)
            const headers = rows[0].map(h => String(h || '').toLowerCase().trim());
            const findCol = (terms) => headers.findIndex(h => terms.some(t => h.includes(t)));

            const map = {
                serial: findCol(['swb serial', 'serial no', 'swb no']),
                custInv: findCol(['cust. inv. no', 'cust inv no', 'customer invoice number']),
                date: findCol(['swb date', 'date']),
                customer: findCol(['customer name', 'client']) || findCol(['customer']),
                custInvNo: findCol(['customer inv. no', 'customer invoice no']),
                shipper: findCol(['shipper name', 'shipper']),
                consignee: findCol(['consignee name', 'consignee']),
                qty: findCol(['orig. qty', 'orig qty', 'quantity']),
                wt: findCol(['orig. wt', 'orig wt', 'weight']),
                city: findCol(['consignee city', 'city']),
                addr: findCol(['consignee address', 'address'])
            };

            const errors = [];
            pendingImportData = rows.slice(1).map((row, idx) => {
                if (!row || !row.length || !row.some(c => c)) return null;
                const get = (k) => map[k] !== -1 ? String(row[map[k]] || '').trim() : '';

                const swbSerial = get('serial');
                if (!swbSerial) {
                    errors.push(`Row ${idx + 2}: Missing SWB Serial Number`);
                    return null;
                }

                return {
                    swbSerial,
                    custInvNo: get('custInv'),
                    swbDate: get('date'),
                    customer: get('customer'),
                    customerInvNo: get('custInvNo'),
                    shipperName: get('shipper'),
                    consigneeName: get('consignee'),
                    origQty: parseInt(get('qty')) || 0,
                    origWt: parseFloat(get('wt')) || 0,
                    consigneeCity: get('city'),
                    consigneeAddress: get('addr')
                };
            }).filter(Boolean);

            if (errors.length) {
                $id('importErrorList').innerHTML = errors.map(e => `<li>${e}</li>`).join('');
                $id('importErrors').classList.remove('hidden');
            } else {
                $id('importErrors').classList.add('hidden');
            }

            $id('importPreviewBody').innerHTML = pendingImportData.slice(0, 5).map(s => `
                <tr><td>${s.swbSerial}</td><td>${s.customer || '—'}</td><td>${s.shipperName || '—'}</td></tr>
            `).join('');

            $id('importPreview').classList.remove('hidden');
            $id('importCount').textContent = `${pendingImportData.length} Valid Records Ready`;
            $id('btnExecuteImport').disabled = pendingImportData.length === 0;
            $id('importStatusTitle').textContent = 'Manifest Verified';

        } catch (err) {
            console.error('[Import Error]', err);
            alert('Parse Error: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
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

window.executeImport = async () => {
    const db = getDb(); if (!db) return;
    const btn = $id('btnExecuteImport');
    btn.disabled = true;
    btn.textContent = 'IMPORTING...';

    let success = 0;
    try {
        for (const item of pendingImportData) {
            await db.saveSwb(item.swbSerial, item);
            success++;
        }
        alert(`Mission Success: ${success} records imported.`);
        window.closeImportModal();
        window.loadDashboard();
        window.refreshDashboard();
    } catch (e) {
        alert(`Import Error: ${e.message}. Success so far: ${success}`);
    } finally {
        btn.textContent = 'PROCESS PERMANENT IMPORT';
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

            // Setup Search Listener with debounce
            let searchTimer;
            $id('inventorySearch')?.addEventListener('input', (e) => {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(() => window.loadDashboard(), 300);
            });

            window.addEventListener('popstate', () => {
                window.loadDashboard();
                window.refreshDashboard();
                window.renderUsers();
            });
        }
    }, 200);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
