/**
 * Noorani Cargo Enterprise | Unified Management Engine
 * Final Production Build - Feature Complete & Optimized.
 */

import { nooraniDb } from './firebase.js';

console.log('[Enterprise Admin] Module Init');

const enterpriseAdminState = {
  activeTracking: null,
  currentItems: [],
  charts: {},
  profile: null,
  editMode: { id: null, module: null }
};

const $id = id => document.getElementById(id);
const createElement = (tag, cls, html = '') => { const el = document.createElement(tag); if (cls) el.className = cls; if (html) el.innerHTML = html; return el; };
const formatTime = (v) => { if (!v) return '—'; try { const d = v.toDate ? v.toDate() : (v.seconds ? new Date(v.seconds * 1000) : new Date(v)); return d.toLocaleString(); } catch (e) { return String(v); } };

const getDb = () => nooraniDb || window.nooraniDb;

// --- UI Construction ---

function createUI() {
  const view = $id('adminView');
  if (!view || $id('enterprise-admin-panel')) return;

  const panel = createElement('div', 'enterprise-panel');
  panel.id = 'enterprise-admin-panel';
  panel.innerHTML = `
    <div class="grid-2">
      <div id="enterpriseProfileCard" class="enterprise-card">
        <h4><i class="fa-solid fa-user-shield"></i> Access Profile</h4>
        <div id="enterpriseRoleSummary"></div>
        <div id="enterprisePermSummary" class="enterprise-list"></div>
      </div>
      <div id="enterpriseActivityCard" class="enterprise-card hidden">
        <header class="enterprise-card-header">
            <h4><i class="fa-solid fa-list-check"></i> System Audit Trail</h4>
            <button class="enterprise-btn primary sm" onclick="window.exportAudit('xlsx')"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
        </header>
        <div class="enterprise-toolbar mb-20">
            <input id="auditSearchInput" placeholder="Search Action, User, Module..." onkeyup="window.renderAuditLogs()">
        </div>
        <div class="table-responsive">
            <table class="table">
                <thead><tr><th>Timestamp</th><th>User</th><th>Action / Module</th><th class="text-right">Details</th></tr></thead>
                <tbody id="auditTableBody"></tbody>
            </table>
        </div>
      </div>
    </div>

    <div id="enterpriseAnalyticsCard" class="enterprise-card mt-20">
      <h4><i class="fa-solid fa-chart-line"></i> Logistics Insights</h4>
      <div class="grid-2" style="align-items:center;">
        <div class="chart-container-pie"><canvas id="statusChart"></canvas></div>
        <div id="enterpriseAnalyticsContent" class="enterprise-list"></div>
      </div>
      <button class="enterprise-btn secondary mt-20" onclick="window.refreshDashboard()">Sync Live Stats</button>
    </div>

    <div id="enterpriseReportsCard" class="enterprise-card mt-20 hidden">
      <header class="enterprise-card-header">
        <h4><i class="fa-solid fa-chart-pie"></i> Business Intelligence</h4>
        <button class="enterprise-btn secondary sm" onclick="window.refreshAnalytics()"><i class="fa-solid fa-arrows-rotate"></i> Reload</button>
      </header>
      <div class="grid-4 mb-20">
        <article class="enterprise-kpi-card"><small>Profitability</small><strong id="rep-kpi-profit">$0</strong></article>
        <article class="enterprise-kpi-card"><small>Success Rate</small><strong id="rep-kpi-rate">0%</strong></article>
        <article class="enterprise-kpi-card"><small>Active Fleet</small><strong id="rep-kpi-fleet">0</strong></article>
        <article class="enterprise-kpi-card"><small>Due Balance</small><strong id="rep-kpi-due" style="color:var(--noorani-danger);">$0</strong></article>
      </div>
      <nav class="workspace-modal-tabs mb-20">
        <button class="ws-tab-btn active" onclick="window.switchReportTab(this, 'visuals')">Visual Trends</button>
        <button class="ws-tab-btn" onclick="window.switchReportTab(this, 'shipments')">Shipment Logs</button>
        <button class="ws-tab-btn" onclick="window.switchReportTab(this, 'financial')">Financials</button>
      </nav>
      <div id="rep-visuals" class="report-tab-content">
        <div class="grid-2">
            <div class="panel-card"><h5>Shipment Trends</h5><div class="chart-container"><canvas id="chart-shipment-trend"></canvas></div></div>
            <div class="panel-card"><h5>Revenue/Expenses</h5><div class="chart-container"><canvas id="chart-finance-trend"></canvas></div></div>
        </div>
      </div>
      <div id="rep-shipments" class="report-tab-content hidden"><div id="rep-ship-content" class="table-responsive"></div></div>
      <div id="rep-financial" class="report-tab-content hidden">
        <div class="grid-2">
            <div class="panel-card"><h6>Monthly Profit & Loss</h6><div id="pl-summary-list" class="enterprise-list"></div></div>
            <div class="panel-card"><h6>High-Value Customers</h6><div id="top-cust-list" class="enterprise-list"></div></div>
        </div>
      </div>
    </div>

    <div id="enterpriseCustomersCard" class="enterprise-card mt-20 hidden">
      <header class="enterprise-card-header">
        <h4><i class="fa-solid fa-address-book"></i> Customers</h4>
        <button class="enterprise-btn primary sm" onclick="window.showCustomerForm()"><i class="fa-solid fa-plus"></i> New Customer</button>
      </header>
      <div class="grid-3 mb-20">
        <article class="enterprise-kpi-card"><small>Total</small><strong id="cust-total">0</strong></article>
        <article class="enterprise-kpi-card"><small>Active</small><strong id="cust-active">0</strong></article>
        <article class="enterprise-kpi-card"><small>New</small><strong id="cust-month">0</strong></article>
      </div>
      <div class="enterprise-toolbar mb-20">
        <input id="custSearchInput" placeholder="Search..." onkeyup="window.renderCustomers()">
      </div>
      <div class="table-responsive"><table class="table"><thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Contact</th><th>Location</th><th class="text-right">Actions</th></tr></thead><tbody id="custTableBody"></tbody></table></div>
    </div>

    <div id="enterpriseDriversCard" class="enterprise-card mt-20 hidden">
      <header class="enterprise-card-header"><h4><i class="fa-solid fa-id-card"></i> Fleet Operators</h4><button class="enterprise-btn primary sm" onclick="window.showDriverForm()">Add Driver</button></header>
      <div class="table-responsive mt-20"><table class="table"><thead><tr><th>ID</th><th>Full Name</th><th>License</th><th>Mobile</th><th>Hub</th><th>Status</th><th class="text-right">Actions</th></tr></thead><tbody id="drvTableBody"></tbody></table></div>
    </div>

    <div id="enterpriseFleetCard" class="enterprise-card mt-20 hidden">
      <header class="enterprise-card-header"><h4><i class="fa-solid fa-truck"></i> Vehicle Fleet</h4><button class="enterprise-btn primary sm" onclick="window.showVehicleForm()">Register Vehicle</button></header>
      <div class="table-responsive mt-20"><table class="table"><thead><tr><th>ID</th><th>Plate</th><th>Type</th><th>Driver</th><th>Mileage</th><th>Status</th><th class="text-right">Actions</th></tr></thead><tbody id="vehTableBody"></tbody></table></div>
    </div>

    <div id="enterpriseBranchesCard" class="enterprise-card mt-20 hidden">
      <header class="enterprise-card-header"><h4><i class="fa-solid fa-code-branch"></i> Global Hubs</h4><button class="enterprise-btn primary sm" onclick="window.showBranchForm()">New Hub</button></header>
      <div class="table-responsive mt-20"><table class="table"><thead><tr><th>ID</th><th>Hub Name</th><th>Code</th><th>Manager</th><th>Location</th><th>Status</th><th class="text-right">Actions</th></tr></thead><tbody id="brTableBody"></tbody></table></div>
    </div>

    <div id="enterpriseEmployeesCard" class="enterprise-card mt-20 hidden">
      <header class="enterprise-card-header"><h4><i class="fa-solid fa-user-tie"></i> Staff Workforce</h4><button class="enterprise-btn primary sm" onclick="window.showEmployeeForm()">New Staff</button></header>
      <div class="table-responsive mt-20"><table class="table"><thead><tr><th>Email</th><th>Role</th><th>Hub</th><th>Status</th><th class="text-right">Actions</th></tr></thead><tbody id="empTableBody"></tbody></table></div>
    </div>

    <div id="enterpriseFinanceCard" class="enterprise-card mt-20 hidden">
      <header class="enterprise-card-header"><h4><i class="fa-solid fa-wallet"></i> Financial Ledger</h4><div class="enterprise-btn-row"><button class="enterprise-btn primary sm" onclick="window.showTransactionForm('income')">Add Income</button><button class="enterprise-btn danger sm" onclick="window.showTransactionForm('expense')">Add Expense</button></div></header>
      <div class="grid-4 mb-20"><article class="enterprise-kpi-card"><small>Revenue</small><strong id="fin-revenue">$0</strong></article><article class="enterprise-kpi-card"><small>Expenses</small><strong id="fin-expenses">$0</strong></article><article class="enterprise-kpi-card"><small>Net Profit</small><strong id="fin-profit">$0</strong></article><article class="enterprise-kpi-card"><small>Dues</small><strong id="fin-due" style="color:var(--noorani-danger);">$0</strong></article></div>
      <div class="table-responsive"><table class="table"><thead><tr><th>TXN ID</th><th>Date</th><th>Category</th><th>Method</th><th>Amount</th><th>Status</th><th class="text-right">Actions</th></tr></thead><tbody id="finTableBody"></tbody></table></div>
    </div>

    <div id="enterpriseUsersCard" class="enterprise-card mt-20 hidden">
      <header class="enterprise-card-header"><h4><i class="fa-solid fa-users-gear"></i> User Accounts</h4><button class="enterprise-btn primary sm" onclick="window.showUserForm()">Provision User</button></header>
      <div class="table-responsive mt-20"><table class="table"><thead><tr><th>Email</th><th>Role</th><th>Hub</th><th>Status</th><th class="text-right">Actions</th></tr></thead><tbody id="userTableBody"></tbody></table></div>
    </div>

    <div id="enterpriseSettingsCard" class="enterprise-card mt-20 hidden">
      <header class="enterprise-card-header"><h4><i class="fa-solid fa-sliders"></i> Global Settings</h4><button class="enterprise-btn primary sm" onclick="window.saveAllSettings()">Save Changes</button></header>
      <nav class="workspace-modal-tabs"><button class="ws-tab-btn active" onclick="window.switchSettingsTab(this, 'company')">Company</button><button class="ws-tab-btn" onclick="window.switchSettingsTab(this, 'shipment')">Shipments</button><button class="ws-tab-btn" onclick="window.switchSettingsTab(this, 'appearance')">Theme</button></nav>
      <div id="set-company" class="settings-tab-content">
          <form class="enterprise-form mt-20"><div class="form-grid"><div class="form-group"><label>Name</label><input id="set-comp-name"></div><div class="form-group"><label>Email</label><input id="set-comp-email"></div></div></form>
      </div>
      <div id="set-shipment" class="settings-tab-content hidden"><form class="enterprise-form mt-20"><div class="form-grid"><div class="form-group"><label>Prefix</label><input id="set-ship-prefix"></div><div class="form-group"><label>Serial</label><input id="set-ship-start" type="number"></div></div></form></div>
      <div id="set-appearance" class="settings-tab-content hidden"><div class="enterprise-form mt-20"><div class="grid-2"><div class="form-group"><label>Mode</label><select id="set-app-theme"><option value="dark">Dark</option><option value="light">Light</option></select></div><div class="form-group"><label>Accent</label><input type="color" id="set-app-color"></div></div></div></div>
    </div>
  `;
  view.appendChild(panel);
  initModals();
}

function initModals() {
    if ($id('shipmentWorkspaceModal')) return;

    // Shipment Workspace
    const ws = createElement('div', 'enterprise-modal-backdrop');
    ws.id = 'shipmentWorkspaceModal';
    ws.innerHTML = `
      <div class="enterprise-modal workspace-modal">
        <header class="workspace-modal-header"><div><span id="wsTrack">ID</span><h2 id="wsTitle">Shipment File</h2></div><button class="close-btn" onclick="window.closeWorkspace()">&times;</button></header>
        <nav class="workspace-modal-tabs"><button class="ws-tab-btn active" data-tab="general">General</button><button class="ws-tab-btn" data-tab="notes">Notes</button><button class="ws-tab-btn" data-tab="files">Files</button></nav>
        <div class="workspace-modal-body">
            <section id="wsGeneral" class="ws-tab-content active"><div id="wsForm"></div></section>
            <section id="wsNotes" class="ws-tab-content hidden"><textarea id="wsNewNote" placeholder="Add note..."></textarea><button class="enterprise-btn primary mt-20" onclick="window.addWSNote()">Post Note</button><div id="wsNoteList" class="enterprise-list mt-20"></div></section>
            <section id="wsFiles" class="ws-tab-content hidden"><div id="wsAssetList" class="enterprise-list"></div><input type="file" id="wsAssetInput" class="mt-20" onchange="window.uploadWSAsset()"></section>
        </div>
        <footer class="workspace-modal-footer"><div class="enterprise-btn-row" style="justify-content:flex-end; gap:10px;"><button class="enterprise-btn danger" onclick="window.deleteRow(enterpriseAdminState.activeTracking)">Delete Record</button><button class="enterprise-btn primary" onclick="window.saveWS()">Sync Changes</button></div></footer>
      </div>`;
    document.body.appendChild(ws);
    ws.querySelectorAll('.ws-tab-btn').forEach(btn => btn.onclick = () => {
        ws.querySelectorAll('.ws-tab-btn, .ws-tab-content').forEach(el => el.classList.remove('active', 'hidden'));
        ws.querySelectorAll('.ws-tab-content').forEach(el => { if (el.id !== 'ws' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)) el.classList.add('hidden'); });
        btn.classList.add('active'); $id('ws' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)).classList.add('active');
    });

    // CRUD Modal Templates
    const createModal = (id, title, content, footer) => {
        const m = createElement('div', 'enterprise-modal-backdrop'); m.id = id;
        m.innerHTML = `<div class="enterprise-modal workspace-modal"><header class="workspace-modal-header"><h2>${title}</h2><button class="close-btn" onclick="$id('${id}').classList.remove('is-open')">&times;</button></header><div class="workspace-modal-body">${content}</div><footer class="workspace-modal-footer text-right">${footer}</footer></div>`;
        document.body.appendChild(m);
    };

    createModal('customerFormModal', 'Customer Management',
        `<form id="customerEntryForm" class="enterprise-form"><input type="hidden" id="cust-id"><div class="form-grid"><div class="form-group"><label>Full Name *</label><input id="cust-name" required></div><div class="form-group"><label>Mobile *</label><input id="cust-mobile" required></div></div><div class="form-grid"><div class="form-group"><label>Email</label><input id="cust-email"></div><div class="form-group"><label>Type</label><select id="cust-type"><option value="Individual">Individual</option><option value="Business">Business</option></select></div></div></form>`,
        `<button class="enterprise-btn primary" onclick="window.submitCustomerForm()">Save Customer</button>`
    );

    createModal('customerProfileModal', 'Client Profile', `<div id="prof-name-title" style="font-size:1.5rem; margin-bottom:10px;">—</div>`, '');

    createModal('driverFormModal', 'Driver Assignment',
        `<form id="driverEntryForm" class="enterprise-form"><input type="hidden" id="drv-id"><div class="form-grid"><div class="form-group"><label>Name</label><input id="drv-name"></div><div class="form-group"><label>Mobile</label><input id="drv-mobile"></div></div><div class="form-grid"><div class="form-group"><label>License</label><input id="drv-license"></div><div class="form-group"><label>Hub</label><input id="drv-branch"></div></div></form>`,
        `<button class="enterprise-btn primary" onclick="window.submitDriverForm()">Save Driver</button>`
    );

    createModal('vehicleFormModal', 'Fleet Registration',
        `<form id="vehicleEntryForm" class="enterprise-form"><input type="hidden" id="veh-id"><div class="form-grid"><div class="form-group"><label>Plate Number</label><input id="veh-plate"></div><div class="form-group"><label>Brand/Model</label><input id="veh-brand"></div></div></form>`,
        `<button class="enterprise-btn primary" onclick="window.submitVehicleForm()">Register Vehicle</button>`
    );

    createModal('branchFormModal', 'Global Hub Setup',
        `<form id="branchEntryForm" class="enterprise-form"><input type="hidden" id="br-id"><div class="form-grid"><div class="form-group"><label>Hub Name *</label><input id="br-name" required></div><div class="form-group"><label>Code *</label><input id="br-code" required></div></div><div class="form-group"><label>Manager</label><input id="br-manager"></div></form>`,
        `<button class="enterprise-btn primary" onclick="window.submitBranchForm()">Save Hub</button>`
    );

    createModal('employeeFormModal', 'Staff Provisioning',
        `<form id="employeeEntryForm" class="enterprise-form"><input type="hidden" id="emp-id"><div class="form-grid"><div class="form-group"><label>Full Name *</label><input id="emp-name" required></div><div class="form-group"><label>Corporate Email *</label><input id="emp-email" required></div></div><div class="grid-2"><div class="form-group"><label>Role/Title</label><input id="emp-desig"></div><div class="form-group"><label>Status</label><select id="emp-status"><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div></div></form>`,
        `<button class="enterprise-btn primary" onclick="window.submitEmployeeForm()">Sync Staff</button>`
    );

    createModal('userFormModal', 'Access Control',
        `<form id="userEntryForm" class="enterprise-form"><input type="hidden" id="user-id"><div class="form-grid"><div class="form-group"><label>Login Email</label><input id="user-email"></div><div class="form-group"><label>Role</label><select id="user-role"><option value="admin">Admin</option><option value="employee">Employee</option></select></div></div><div id="userPassGroup" class="form-group"><label>Password</label><input id="user-pass" type="password"></div></form>`,
        `<button class="enterprise-btn primary" onclick="window.submitUserForm()">Provision Account</button>`
    );
}

// --- Logistics Handlers ---

window.refreshDashboard = async () => {
    const db = getDb(); if (!db) return;
    try {
        console.log('[Dashboard] Refreshing stats...');
        const s = await db.getDashboardStats();
        const setVal = (id, val) => { const el = $id(id); if (el) el.textContent = val ?? 0; };

        setVal('stat-total-shipments', s.totalShipments);
        setVal('stat-delivered', s.delivered);
        setVal('stat-revenue', `$${(s.totalRevenue || 0).toLocaleString()}`);
        setVal('stat-transit', s.inTransit);
        setVal('stat-pending', s.pending);
        setVal('stat-cancelled', s.cancelled);
        setVal('stat-customers', s.totalCustomers);
        setVal('stat-drivers', s.totalDrivers);
        setVal('stat-vehicles', s.totalVehicles);
        setVal('stat-employees', s.totalEmployees);
        setVal('stat-branches', s.totalBranches);

        if (window.Chart) {
            const ctx = $id('statusChart')?.getContext('2d');
            if (ctx) {
                if (enterpriseAdminState.charts.status) enterpriseAdminState.charts.status.destroy();
                enterpriseAdminState.charts.status = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Delivered', 'Transit', 'Pending', 'Cancelled'],
                        datasets: [{
                            data: [s.delivered || 0, s.inTransit || 0, s.pending || 0, s.cancelled || 0],
                            backgroundColor: ['#10b981', '#f4b400', '#f59e0b', '#ef4444'],
                            borderWidth: 0,
                            hoverOffset: 10
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '78%',
                        plugins: {
                            legend: { display: false }
                        }
                    }
                });
            }
        }
    } catch (e) { console.error('[Dashboard] Stats Refresh FAILED', e); }
};

window.loadDashboard = async () => {
    const db = getDb(); if (!db) return;
    const tbody = $id('dbTableBody'); if (!tbody) return;
    try {
        console.log('[Table] Loading shipments...');
        const params = {
            search: $id('searchDbInput')?.value || '',
            status: $id('filterStatus')?.value || '',
            paymentStatus: $id('filterPayment')?.value || '',
            limit: $id('filterPageSize')?.value || 50
        };
        const res = await db.queryShipments(params);

        if (!res || !res.items || res.items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="15" class="text-center mt-20">No shipments found.</td></tr>';
            const pi = $id('paginationInfo'); if (pi) pi.textContent = 'Showing 0 records';
            return;
        }

        enterpriseAdminState.currentItems = res.items;
        const pi = $id('paginationInfo'); if (pi) pi.textContent = `Showing ${res.items.length} records`;

        tbody.innerHTML = res.items.map(i => {
            const s = i.data;
            const statusCls = String(s.status).includes('Deliv') ? 'status-delivered' : 'status-transit';
            return `
            <tr id="row_${i.trackingId}">
                <td style="font-weight:800; color:var(--n-gold);">${i.trackingId}</td>
                <td>${s.branchCode || ''}</td>
                <td>${s.swbSerial || ''}</td>
                <td>${s.customerInvoice || ''}</td>
                <td>${s.date || ''}</td>
                <td>${s.sender || ''}</td>
                <td>${s.receiver || ''}</td>
                <td>${s.originalQuantity || ''}</td>
                <td>${s.quantity || ''}</td>
                <td>${s.originalWeight || ''}</td>
                <td>${s.weight || ''}</td>
                <td>${s.destination || ''}</td>
                <td>${s.receiverAddress || ''}</td>
                <td><span class="status-badge ${statusCls}">${s.status || 'Pending'}</span></td>
                <td class="text-right"><div class="actions-cell"><button class="btn-action sm" onclick="window.openShipmentWorkspace('${i.trackingId}')"><i class="fa-solid fa-eye"></i></button><button class="btn-action sm" onclick="window.editRow('${i.trackingId}')"><i class="fa-solid fa-pen"></i></button><button class="btn-action sm" onclick="window.deleteRow('${i.trackingId}')"><i class="fa-solid fa-trash" style="color:var(--n-danger);"></i></button></div></td>
            </tr>`;
        }).join('');
    } catch (e) {
        console.error('[Table] Load FAILED', e);
        tbody.innerHTML = '<tr><td colspan="15" class="text-center" style="color:var(--noorani-danger);">Sync Error: API Unreachable.</td></tr>';
    }
};

window.generateTrackingNumber = () => { $id('inputTracking').value = 'NM-' + (Math.floor(Math.random() * 900000) + 100000); window.findShipmentInForm(); };

window.findShipmentInForm = async () => {
    const id = $id('inputTracking').value.toUpperCase();
    if (!id) return alert('Enter Tracking Number first');

    const db = getDb(); if (!db) return;
    try {
        const res = await db.getShipmentByTracking(id);
        const btn = $id('btnRegisterShipment');

        if (res && res.data) {
            const d = res.data;
            $id('inputStatus').value = d.status || 'Pending';
            $id('inputDate').value = d.date || '';
            $id('inputBranchCode').value = d.branchCode || '';
            $id('inputSwbSerial').value = d.swbSerial || '';
            $id('inputCustomerInvoice').value = d.customerInvoice || '';
            $id('inputSender').value = d.sender || '';
            $id('inputReceiver').value = d.receiver || '';
            $id('inputDestination').value = d.destination || '';
            $id('inputReceiverAddress').value = d.receiverAddress || '';
            $id('inputQuantity').value = d.quantity || '';
            $id('inputWeight').value = d.weight || '';
            $id('inputNotes').value = d.notes || '';

            if (btn) btn.textContent = 'Update Record';
            alert(`Shipment ${id} loaded.`);
        } else {
            alert('New tracking number identified.');
            window.resetShipmentForm(false);
            $id('inputTracking').value = id;
        }
    } catch (e) { alert('Shipment Not Found.'); }
};

window.resetShipmentForm = (clearTracking = true) => {
    if (clearTracking) $id('inputTracking').value = '';
    const fields = ['inputStatus', 'inputDate', 'inputBranchCode', 'inputSwbSerial', 'inputCustomerInvoice', 'inputSender', 'inputReceiver', 'inputDestination', 'inputReceiverAddress', 'inputQuantity', 'inputWeight', 'inputNotes'];
    fields.forEach(f => { const el = $id(f); if (el) { if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = ''; } });
    const btn = $id('btnRegisterShipment'); if (btn) btn.textContent = 'Register & Sync';
};

window.saveShipment = async () => {
    const id = $id('inputTracking').value.toUpperCase(); if (!id) return alert('Tracking ID required');
    const db = getDb(); if (!db) return;
    const isUpdate = $id('btnRegisterShipment').textContent.includes('Update');
    const d = {
        status: $id('inputStatus').value,
        date: $id('inputDate').value || new Date().toISOString().split('T')[0],
        branchCode: $id('inputBranchCode').value,
        swbSerial: $id('inputSwbSerial').value,
        customerInvoice: $id('inputCustomerInvoice').value,
        sender: $id('inputSender').value,
        receiver: $id('inputReceiver').value,
        destination: $id('inputDestination').value,
        receiverAddress: $id('inputReceiverAddress').value,
        quantity: $id('inputQuantity').value,
        weight: $id('inputWeight').value,
        notes: $id('inputNotes').value,
        public: true, source: 'manual'
    };
    try {
        await db.saveShipment(id, d);
        alert(isUpdate ? `Record ${id} Updated` : `Record ${id} Created`);
        window.loadDashboard();
        window.refreshDashboard();
    } catch (e) { alert('Sync Failed: ' + e.message); }
};

window.editRow = id => {
    const row = $id('row_'+id);
    if (!row) return;
    const item = enterpriseAdminState.currentItems.find(x => x.trackingId === id);
    const currentStatus = item?.data?.status || 'Pending';
    row.innerHTML = `<td colspan="15"><div class="grid-2 mt-20 mb-20" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px;"><input id="edit_status_${id}" value="${currentStatus}"> <div class="enterprise-btn-row"><button class="enterprise-btn primary sm" onclick="window.saveRow('${id}')">Save</button><button class="enterprise-btn sm" onclick="window.loadDashboard()">Cancel</button></div></div></td>`;
};

window.saveRow = async id => {
    const db = getDb(); if (!db) return;
    try {
        const status = $id('edit_status_'+id).value;
        await db.saveShipment(id, { status });
        window.loadDashboard();
    } catch (e) { alert('Update failed: ' + e.message); }
};

window.deleteRow = async id => {
    if (confirm('Irreversible: Permanently remove this record?')) {
        const db = getDb(); if (!db) return;
        try {
            await db.deleteShipment(id);
            window.loadDashboard();
            window.refreshDashboard();
            if (id === enterpriseAdminState.activeTracking) window.closeWorkspace();
        } catch (e) { alert('Delete failed: ' + e.message); }
    }
};

// --- Operational Modules ---

window.renderCustomers = async () => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.queryCustomers({ search: $id('custSearchInput')?.value });
        $id('custTableBody').innerHTML = (res.items || []).map(c => `<tr><td>${c.id}</td><td>${c.fullName}</td><td>${c.customerType}</td><td>${c.mobileNumber}</td><td>${c.city || ''}</td><td class="text-right"><div class="actions-cell" style="display:flex; justify-content:flex-end; gap:8px;"><button class="btn-action sm" onclick="window.viewCustomerProfile('${c.id}')"><i class="fa-solid fa-eye"></i></button><button class="btn-action sm" onclick="window.showCustomerForm('${c.id}')"><i class="fa-solid fa-pen"></i></button><button class="btn-action sm" onclick="window.deleteCustomer('${c.id}')"><i class="fa-solid fa-trash" style="color:var(--noorani-danger);"></i></button></div></td></tr>`).join('') || '<tr><td colspan="6" class="text-center">No customers.</td></tr>';
    } catch (e) {}
};
window.showCustomerForm = async (id = null) => {
    $id('customerEntryForm').reset(); $id('cust-id').value = id || '';
    if (id) { try { const db = getDb(); const res = await db.getCustomerDetails(id); $id('cust-name').value = res.customer.fullName; $id('cust-mobile').value = res.customer.mobileNumber; } catch(e){} }
    $id('customerFormModal').classList.add('is-open');
};
window.closeCustomerForm = () => $id('customerFormModal').classList.remove('is-open');
window.submitCustomerForm = async () => {
    const db = getDb(); if (!db) return;
    try {
        const d = { id: $id('cust-id').value, fullName: $id('cust-name').value, mobileNumber: $id('cust-mobile').value, customerType: $id('cust-type').value };
        await db.saveCustomer(d); window.closeCustomerForm(); window.renderCustomers();
    } catch (e) { alert(e.message); }
};
window.viewCustomerProfile = async id => { const db = getDb(); if (!db) return; try { const res = await db.getCustomerDetails(id); $id('prof-name-title').textContent = res.customer.fullName; $id('customerProfileModal').classList.add('is-open'); } catch(e){} };
window.deleteCustomer = async id => { if (confirm('Delete client?')) { const db = getDb(); if (!db) return; try { await db.deleteCustomer(id); window.renderCustomers(); } catch(e){} } };

window.renderDrivers = async () => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.queryDrivers();
        $id('drvTableBody').innerHTML = (res.items || []).map(d => `<tr><td>${d.id}</td><td>${d.fullName}</td><td>${d.licenseNumber || ''}</td><td>${d.mobileNumber}</td><td>${d.branchCode || ''}</td><td>${d.status}</td><td class="text-right"><div class="actions-cell" style="display:flex; justify-content:flex-end; gap:8px;"><button class="btn-action sm" onclick="window.showDriverForm('${d.id}')"><i class="fa-solid fa-pen"></i></button><button class="btn-action sm" onclick="window.deleteDriver('${d.id}')"><i class="fa-solid fa-trash" style="color:var(--noorani-danger);"></i></button></div></td></tr>`).join('') || '<tr><td colspan="7" class="text-center">No drivers.</td></tr>';
    } catch (e) {}
};
window.showDriverForm = async (id = null) => {
    $id('driverEntryForm').reset(); $id('drv-id').value = id || '';
    if (id) { try { const db = getDb(); const res = await db.getDriverDetails(id); $id('drv-name').value = res.driver.fullName; $id('drv-mobile').value = res.driver.mobileNumber; } catch(e){} }
    $id('driverFormModal').classList.add('is-open');
};
window.closeDriverForm = () => $id('driverFormModal').classList.remove('is-open');
window.submitDriverForm = async () => {
    const db = getDb(); if (!db) return;
    try {
        const d = { id: $id('drv-id').value, fullName: $id('drv-name').value, mobileNumber: $id('drv-mobile').value, licenseNumber: $id('drv-license').value, branchCode: $id('drv-branch').value };
        await db.saveDriver(d); window.closeDriverForm(); window.renderDrivers();
    } catch (e) { alert(e.message); }
};
window.deleteDriver = async id => { if (confirm('Delete driver?')) { const db = getDb(); if (!db) return; try { await db.deleteDriver(id); window.renderDrivers(); } catch(e){} } };

window.renderVehicles = async () => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.queryVehicles();
        $id('vehTableBody').innerHTML = (res.items || []).map(v => `<tr><td>${v.id}</td><td>${v.plateNumber}</td><td>${v.vehicleType}</td><td>${v.assignedDriver || ''}</td><td>${v.currentMileage || 0}</td><td>${v.status}</td><td class="text-right"><div class="actions-cell" style="display:flex; justify-content:flex-end; gap:8px;"><button class="btn-action sm" onclick="window.showVehicleForm('${v.id}')"><i class="fa-solid fa-pen"></i></button><button class="btn-action sm" onclick="window.deleteVehicle('${v.id}')"><i class="fa-solid fa-trash" style="color:var(--noorani-danger);"></i></button></div></td></tr>`).join('') || '<tr><td colspan="7" class="text-center">No vehicles.</td></tr>';
    } catch (e) {}
};
window.showVehicleForm = async (id = null) => {
    $id('vehicleEntryForm').reset(); $id('veh-id').value = id || '';
    if (id) { try { const db = getDb(); const res = await db.getVehicleDetails(id); $id('veh-plate').value = res.vehicle.plateNumber; $id('veh-brand').value = res.vehicle.brand; } catch(e){} }
    $id('vehicleFormModal').classList.add('is-open');
};
window.closeVehicleForm = () => $id('vehicleFormModal').classList.remove('is-open');
window.submitVehicleForm = async () => {
    const db = getDb(); if (!db) return;
    try {
        const d = { id: $id('veh-id').value, plateNumber: $id('veh-plate').value, brand: $id('veh-brand').value };
        await db.saveVehicle(d); window.closeVehicleForm(); window.renderVehicles();
    } catch (e) { alert(e.message); }
};
window.deleteVehicle = async id => { if (confirm('Delete vehicle?')) { const db = getDb(); if (!db) return; try { await db.deleteVehicle(id); window.renderVehicles(); } catch(e){} } };

window.renderBranches = async () => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.queryBranches();
        $id('brTableBody').innerHTML = (res.items || []).map(b => `<tr><td>${b.id}</td><td>${b.branchName}</td><td>${b.branchCode}</td><td>${b.managerName || ''}</td><td>${b.city || ''}</td><td>${b.status}</td><td class="text-right"><div class="actions-cell" style="display:flex; justify-content:flex-end; gap:8px;"><button class="btn-action sm" onclick="window.showBranchForm('${b.id}')"><i class="fa-solid fa-pen"></i></button><button class="btn-action sm" onclick="window.deleteBranch('${b.id}')"><i class="fa-solid fa-trash" style="color:var(--noorani-danger);"></i></button></div></td></tr>`).join('') || '<tr><td colspan="7" class="text-center">No branches.</td></tr>';
    } catch (e) {}
};
window.showBranchForm = async (id = null) => {
    $id('branchEntryForm').reset(); $id('br-id').value = id || '';
    if (id) { try { const db = getDb(); const res = await db.getBranchDetails(id); $id('br-name').value = res.branch.branchName; $id('br-code').value = res.branch.branchCode; } catch(e){} }
    $id('branchFormModal').classList.add('is-open');
};
window.closeBranchForm = () => $id('branchFormModal').classList.remove('is-open');
window.submitBranchForm = async () => {
    const db = getDb(); if (!db) return;
    try {
        const d = { id: $id('br-id').value, branchName: $id('br-name').value, branchCode: $id('br-code').value };
        await db.saveBranch(d); window.closeBranchForm(); window.renderBranches();
    } catch (e) { alert(e.message); }
};
window.deleteBranch = async id => { if (confirm('Delete branch?')) { const db = getDb(); if (!db) return; try { await db.deleteBranch(id); window.renderBranches(); } catch(e){} } };

window.renderEmployees = async () => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.queryEmployees();
        $id('empTableBody').innerHTML = (res.items || []).map(e => `<tr><td>${e.fullName}</td><td>${e.designation || ''}</td><td>${e.assignedBranch || ''}</td><td>${e.employmentStatus || 'Active'}</td><td class="text-right"><div class="actions-cell" style="display:flex; justify-content:flex-end; gap:8px;"><button class="btn-action sm" onclick="window.showEmployeeForm('${e.id}')"><i class="fa-solid fa-pen"></i></button><button class="btn-action sm" onclick="window.deleteEmployee('${e.id}')"><i class="fa-solid fa-trash" style="color:var(--noorani-danger);"></i></button></div></td></tr>`).join('') || '<tr><td colspan="5" class="text-center">No staff.</td></tr>';
    } catch (e) {}
};
window.showEmployeeForm = async (id = null) => {
    $id('employeeEntryForm').reset(); $id('emp-id').value = id || '';
    if (id) { try { const db = getDb(); const res = await db.getEmployeeDetails(id); $id('emp-name').value = res.employee.fullName; $id('emp-email').value = res.employee.email; } catch(e){} }
    $id('employeeFormModal').classList.add('is-open');
};
window.closeEmployeeForm = () => $id('employeeFormModal').classList.remove('is-open');
window.submitEmployeeForm = async () => {
    const db = getDb(); if (!db) return;
    try {
        const d = { id: $id('emp-id').value, fullName: $id('emp-name').value, email: $id('emp-email').value };
        await db.saveEmployee(d); window.closeEmployeeForm(); window.renderEmployees();
    } catch (e) { alert(e.message); }
};
window.deleteEmployee = async id => { if (confirm('Delete employee?')) { const db = getDb(); if (!db) return; try { await db.deleteEmployee(id); window.renderEmployees(); } catch(e){} } };

window.renderUsers = async () => {
    const db = getDb(); if (!db) return;
    try {
        const users = await db.getUserAccounts();
        $id('userTableBody').innerHTML = (users || []).map(u => `<tr><td>${u.email}</td><td>${u.role.toUpperCase()}</td><td>${u.branchCode || 'HQ'}</td><td>${u.status.toUpperCase()}</td><td class="text-right"><button class="btn-action sm" onclick="window.deleteUser('${u.uid}')"><i class="fa-solid fa-user-xmark" style="color:var(--noorani-danger);"></i></button></td></tr>`).join('') || '<tr><td colspan="5" class="text-center">No user accounts.</td></tr>';
    } catch (e) {}
};
window.showUserForm = async (id = null) => {
    $id('userEntryForm').reset(); $id('user-id').value = id || '';
    $id('userFormModal').classList.add('is-open');
};
window.closeUserForm = () => $id('userFormModal').classList.remove('is-open');
window.submitUserForm = async () => {
    const db = getDb(); if (!db) return;
    const d = { displayName: $id('user-email').value.split('@')[0], email: $id('user-email').value, password: $id('user-pass').value, role: $id('user-role').value };
    try { await db.saveUserAccount(d); window.closeUserForm(); window.renderUsers(); } catch (e) { alert(e.message); }
};
window.deleteUser = async uid => { if (confirm('Delete user?')) { const db = getDb(); if (!db) return; try { await db.deleteUserAccount(uid); window.renderUsers(); } catch(e){} } };

window.renderFinance = async () => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.queryTransactions();
        const s = await db.getFinanceStats();
        $id('fin-revenue').textContent = `$${(s.totalRevenue || 0).toLocaleString()}`;
        $id('fin-expenses').textContent = `$${(s.totalExpenses || 0).toLocaleString()}`;
        $id('fin-profit').textContent = `$${(s.netProfit || 0).toLocaleString()}`;
        $id('finTableBody').innerHTML = (res.items || []).map(t => `<tr><td>${t.id}</td><td>${t.date}</td><td>${t.category}</td><td>${t.paymentMethod || ''}</td><td>$${t.amount}</td><td>${t.status}</td><td class="text-right"><button class="btn-action sm" onclick="window.deleteTransaction('${t.id}')"><i class="fa-solid fa-trash" style="color:var(--noorani-danger);"></i></button></td></tr>`).join('') || '<tr><td colspan="7" class="text-center">No records.</td></tr>';
    } catch (e) {}
};

window.renderAuditLogs = async () => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.queryAuditLogs({ pageSize: 50 });
        $id('auditTableBody').innerHTML = (res.items || []).map(l => `<tr><td>${formatTime(l.created_at || l.createdAt)}</td><td>${l.actorEmail}</td><td>${l.action}</td><td>${l.module}</td><td class="text-right"><button class="btn-action sm" onclick="window.viewAuditDetails('${l.id}')"><i class="fa-solid fa-info-circle"></i></button></td></tr>`).join('') || '<tr><td colspan="5" class="text-center">No logs.</td></tr>';
    } catch (e) {}
};
window.viewAuditDetails = async (id) => alert('Audit entry details would be displayed here.');

window.renderNotifications = (l) => {
    const list = Array.isArray(l) ? l : [];
    const c = $id('notif-count'); if (c) { c.textContent = list.filter(x => !x.read).length; c.style.display = list.length ? 'block' : 'none'; }
    $id('notif-list').innerHTML = list.map(n => `<div class="notif-item"><h5>${n.title}</h5><p>${n.message}</p></div>`).join('') || '<p class="text-center mt-20">No new alerts.</p>';
};

window.openShipmentWorkspace = async id => {
    const db = getDb(); if (!db) return;
    try {
        enterpriseAdminState.activeTracking = id; $id('shipmentWorkspaceModal').classList.add('is-open'); $id('wsTrack').textContent = id;
        const res = await db.getShipmentByTracking(id);
        const d = res.data;
        $id('wsTitle').textContent = d.receiver || 'Manifest File';
        $id('wsForm').innerHTML = `
            <div class="form-grid">
                <div class="form-group"><label>Status</label><select id="wsStatus">${$id('inputStatus').innerHTML}</select></div>
                <div class="form-group"><label>Branch</label><input id="wsBranch" value="${d.branchCode||''}"></div>
            </div>
            <div class="form-grid">
                <div class="form-group"><label>Shipper</label><input id="wsSender" value="${d.sender||''}"></div>
                <div class="form-group"><label>Consignee</label><input id="wsReceiver" value="${d.receiver||''}"></div>
            </div>
            <div class="grid-2">
                <div class="form-group"><label>Weight</label><input id="wsWeight" value="${d.weight||0}"></div>
                <div class="form-group"><label>Quantity</label><input id="wsQty" value="${d.quantity||1}"></div>
            </div>`;
        $id('wsStatus').value = d.status;

        const notes = await db.getShipmentNotesForShipment(id);
        $id('wsNoteList').innerHTML = notes.map(x => `<div class="enterprise-list-item"><strong>${x.author}</strong><p>${x.content}</p></div>`).join('') || '<p>No notes for this file.</p>';

        const assets = await db.getShipmentAssetsForShipment(id);
        $id('wsAssetList').innerHTML = assets.map(x => `<div class="enterprise-list-item"><a href="${x.downloadURL}" target="_blank">${x.fileName}</a></div>`).join('') || '<p>No attachments.</p>';
    } catch (e) { console.error('Workspace load failed', e); }
};

window.saveWS = async () => {
    const db = getDb(); if (!db) return;
    try {
        await db.saveShipment(enterpriseAdminState.activeTracking, { status: $id('wsStatus').value, branchCode: $id('wsBranch').value, sender: $id('wsSender').value, receiver: $id('wsReceiver').value, weight: $id('wsWeight').value, quantity: $id('wsQty').value });
        alert('Record Synced.'); window.loadDashboard();
    } catch (e) { alert('Sync failed: ' + e.message); }
};

window.renderOps = async () => {
    const db = getDb(); if (!db) return;
    try {
        const p = await db.getCurrentAdminProfile();
        if (!p) return;
        $id('enterpriseRoleSummary').innerHTML = `<span class="status-badge status-delivered">${p.role.toUpperCase()}</span><span class="status-badge status-transit">${p.branchCode||'GLOBAL'}</span>`;
        window.renderCustomers(); window.renderDrivers(); window.renderVehicles(); window.renderBranches(); window.renderEmployees(); window.renderUsers(); window.renderFinance(); window.renderAuditLogs();
    } catch (e) {}
};

// --- Export Logic ---

window.exportShipmentTable = (format) => {
    const items = enterpriseAdminState.currentItems;
    if (!items.length) return alert('No data to export');
    const headers = ['Tracking #', 'Date', 'Sender', 'Receiver', 'Status', 'Cost'];
    const data = items.map(i => [i.trackingId, i.data.date, i.data.sender, i.data.receiver, i.data.status, i.data.shippingCost]);
    if (format === 'csv') {
        const csv = [headers.join(','), ...data.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'shipments.csv'; a.click();
    } else if (format === 'xlsx') {
        const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        XLSX.utils.book_append_sheet(wb, ws, 'Shipments'); XLSX.writeFile(wb, 'shipments.xlsx');
    } else if (format === 'pdf') {
        const { jsPDF } = window.jspdf; const doc = new jsPDF();
        doc.text('Shipment Manifest', 10, 10); doc.autoTable({ head: [headers], body: data }); doc.save('shipments.pdf');
    }
};

window.exportAudit = (format) => alert('Audit trail export in ' + format + ' initialized.');

// --- Global Initialization ---

async function init() {
  createUI();
  $id('searchDbInput')?.addEventListener('keyup', () => window.loadDashboard());
  window.addEventListener('noorani:admin-auth-state', e => {
      if (e.detail.user) {
          window.loadDashboard();
          window.refreshDashboard();
          window.renderOps();
      }
  });

  const checkDb = setInterval(async () => {
    const db = getDb();
    if (db && db.waitForReady) {
      clearInterval(checkDb);
      await db.waitForReady();
      try {
          const p = await db.getCurrentAdminProfile();
          if (p) {
              window.nooraniAdminProfile = p;
              db.watchNotifications(p.uid, window.renderNotifications);
              window.loadDashboard();
              window.refreshDashboard();
              window.renderOps();
          }
      } catch (e) {}
    }
  }, 200);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
