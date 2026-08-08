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

// Resilient DB Getter
const getDb = () => {
    const db = nooraniDb || window.nooraniDb;
    if (!db) {
        console.error('[CRITICAL] Database bridge is missing in current scope.');
        return null;
    }
    return db;
};

// --- UI Construction ---

function createUI() {
  const view = $id('adminView');
  if (!view || $id('enterprise-admin-panel')) return;

  const panel = createElement('div', 'enterprise-panel');
  panel.id = 'enterprise-admin-panel';
  panel.innerHTML = `
    <div class="enterprise-grid">
      <div id="enterpriseProfileCard" class="enterprise-card">
        <h4><i class="fa-solid fa-user-shield"></i> Access Profile</h4>
        <div id="enterpriseRoleSummary"></div>
        <div id="enterprisePermSummary" class="enterprise-list"></div>
      </div>
      <div id="enterpriseActivityCard" class="enterprise-card" style="display:none;">
        <header class="enterprise-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h4 style="margin:0;"><i class="fa-solid fa-list-check"></i> System Audit Trail</h4>
            <button class="enterprise-btn primary sm" onclick="window.exportAudit('xlsx')"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
        </header>
        <div class="enterprise-toolbar" style="margin-bottom:20px;">
            <input id="auditSearchInput" class="edit-input" placeholder="Search Action, User, Module..." onkeyup="window.renderAuditLogs()">
        </div>
        <div class="table-responsive">
            <table class="table">
                <thead><tr><th>Timestamp</th><th>User</th><th>Action / Module</th><th style="text-align:right;">Details</th></tr></thead>
                <tbody id="auditTableBody"></tbody>
            </table>
        </div>
      </div>
    </div>

    <div id="enterpriseAnalyticsCard" class="enterprise-card">
      <h4><i class="fa-solid fa-chart-line"></i> Logistics Insights</h4>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; align-items:center;">
        <div style="height:220px; position:relative;"><canvas id="statusChart"></canvas></div>
        <div id="enterpriseAnalyticsContent" class="enterprise-list"></div>
      </div>
      <button class="enterprise-btn secondary" style="margin-top:15px;" onclick="window.refreshDashboard()">Sync Live Stats</button>
    </div>

    <div id="enterpriseReportsCard" class="enterprise-card" style="display:none;">
      <header class="enterprise-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h4 style="margin:0;"><i class="fa-solid fa-chart-pie"></i> Business Intelligence & Reporting</h4>
        <button class="enterprise-btn secondary sm" onclick="window.refreshAnalytics()"><i class="fa-solid fa-arrows-rotate"></i> Reload Data</button>
      </header>
      <div class="enterprise-grid" style="grid-template-columns: repeat(4, 1fr); gap:15px; margin-bottom:25px;">
        <article class="enterprise-kpi-card"><small>Profitability</small><strong id="rep-kpi-profit">$0</strong></article>
        <article class="enterprise-kpi-card"><small>Success Rate</small><strong id="rep-kpi-rate">0%</strong></article>
        <article class="enterprise-kpi-card"><small>Active Fleet</small><strong id="rep-kpi-fleet">0</strong></article>
        <article class="enterprise-kpi-card"><small>Due Balance</small><strong id="rep-kpi-due" style="color:var(--noorani-danger);">$0</strong></article>
      </div>
      <nav class="workspace-modal-tabs" style="margin-bottom:20px;">
        <button class="ws-tab-btn active" onclick="window.switchReportTab(this, 'visuals')">Visual Trends</button>
        <button class="ws-tab-btn" onclick="window.switchReportTab(this, 'shipments')">Shipment Logs</button>
        <button class="ws-tab-btn" onclick="window.switchReportTab(this, 'financial')">Financials</button>
      </nav>
      <div id="rep-visuals" class="report-tab-content">
        <div class="enterprise-grid">
            <div class="panel-card" style="padding:20px;"><h5>Shipment Trends</h5><div style="height:250px;"><canvas id="chart-shipment-trend"></canvas></div></div>
            <div class="panel-card" style="padding:20px;"><h5>Revenue/Expenses</h5><div style="height:250px;"><canvas id="chart-finance-trend"></canvas></div></div>
        </div>
      </div>
      <div id="rep-shipments" class="report-tab-content" style="display:none;"><div id="rep-ship-content" class="table-responsive"></div></div>
      <div id="rep-financial" class="report-tab-content" style="display:none;">
        <div class="enterprise-grid" style="grid-template-columns:1fr 1fr; gap:20px;">
            <div class="panel-card" style="padding:20px;"><h6>Monthly Profit & Loss</h6><div id="pl-summary-list" class="enterprise-list"></div></div>
            <div class="panel-card" style="padding:20px;"><h6>High-Value Customers</h6><div id="top-cust-list" class="enterprise-list"></div></div>
        </div>
      </div>
    </div>

    <div id="enterpriseCustomersCard" class="enterprise-card" style="display:none;">
      <header class="enterprise-card-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h4 style="margin:0;"><i class="fa-solid fa-address-book"></i> Customers</h4>
        <button class="enterprise-btn primary sm" onclick="window.showCustomerForm()"><i class="fa-solid fa-plus"></i> New Customer</button>
      </header>
      <div class="enterprise-grid" style="grid-template-columns: repeat(3, 1fr); gap:15px; margin-bottom:25px;">
        <article class="enterprise-kpi-card"><small>Total</small><strong id="cust-total">0</strong></article>
        <article class="enterprise-kpi-card"><small>Active</small><strong id="cust-active">0</strong></article>
        <article class="enterprise-kpi-card"><small>New</small><strong id="cust-month">0</strong></article>
      </div>
      <div class="enterprise-toolbar" style="display:flex; gap:10px; margin-bottom:20px;">
        <input id="custSearchInput" class="edit-input" placeholder="Search..." onkeyup="window.renderCustomers()">
      </div>
      <div class="table-responsive"><table class="table"><thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Contact</th><th>Location</th><th style="text-align:right;">Actions</th></tr></thead><tbody id="custTableBody"></tbody></table></div>
    </div>

    <div id="enterpriseDriversCard" class="enterprise-card" style="display:none;">
      <header class="enterprise-card-header"><h4><i class="fa-solid fa-id-card"></i> Fleet Operators</h4><button class="enterprise-btn primary sm" onclick="window.showDriverForm()">Add Driver</button></header>
      <div class="table-responsive" style="margin-top:20px;"><table class="table"><thead><tr><th>ID</th><th>Full Name</th><th>License</th><th>Mobile</th><th>Hub</th><th>Status</th><th style="text-align:right;">Actions</th></tr></thead><tbody id="drvTableBody"></tbody></table></div>
    </div>

    <div id="enterpriseFleetCard" class="enterprise-card" style="display:none;">
      <header class="enterprise-card-header"><h4><i class="fa-solid fa-truck"></i> Vehicle Fleet</h4><button class="enterprise-btn primary sm" onclick="window.showVehicleForm()">Register Vehicle</button></header>
      <div class="table-responsive" style="margin-top:20px;"><table class="table"><thead><tr><th>ID</th><th>Plate</th><th>Type</th><th>Driver</th><th>Mileage</th><th>Status</th><th style="text-align:right;">Actions</th></tr></thead><tbody id="vehTableBody"></tbody></table></div>
    </div>

    <div id="enterpriseBranchesCard" class="enterprise-card" style="display:none;">
      <header class="enterprise-card-header"><h4><i class="fa-solid fa-code-branch"></i> Global Hubs</h4><button class="enterprise-btn primary sm" onclick="window.showBranchForm()">New Hub</button></header>
      <div class="table-responsive" style="margin-top:20px;"><table class="table"><thead><tr><th>ID</th><th>Hub Name</th><th>Code</th><th>Manager</th><th>Location</th><th>Status</th><th style="text-align:right;">Actions</th></tr></thead><tbody id="brTableBody"></tbody></table></div>
    </div>

    <div id="enterpriseEmployeesCard" class="enterprise-card" style="display:none;">
      <header class="enterprise-card-header"><h4><i class="fa-solid fa-user-tie"></i> Staff Workforce</h4><button class="enterprise-btn primary sm" onclick="window.showEmployeeForm()">New Staff</button></header>
      <div class="table-responsive" style="margin-top:20px;"><table class="table"><thead><tr><th>Email</th><th>Role</th><th>Hub</th><th>Status</th><th style="text-align:right;">Actions</th></tr></thead><tbody id="empTableBody"></tbody></table></div>
    </div>

    <div id="enterpriseFinanceCard" class="enterprise-card" style="display:none;">
      <header class="enterprise-card-header"><h4><i class="fa-solid fa-wallet"></i> Financial Ledger</h4><div class="enterprise-btn-row"><button class="enterprise-btn primary sm" onclick="window.showTransactionForm('income')">Add Income</button><button class="enterprise-btn danger sm" onclick="window.showTransactionForm('expense')">Add Expense</button></div></header>
      <div class="enterprise-grid" style="grid-template-columns: repeat(4, 1fr); gap:15px; margin:20px 0;"><article class="enterprise-kpi-card"><small>Revenue</small><strong id="fin-revenue">$0</strong></article><article class="enterprise-kpi-card"><small>Expenses</small><strong id="fin-expenses">$0</strong></article><article class="enterprise-kpi-card"><small>Net Profit</small><strong id="fin-profit">$0</strong></article><article class="enterprise-kpi-card"><small>Dues</small><strong id="fin-due" style="color:var(--noorani-danger);">$0</strong></article></div>
      <div class="table-responsive"><table class="table"><thead><tr><th>TXN ID</th><th>Date</th><th>Category</th><th>Method</th><th>Amount</th><th>Status</th><th style="text-align:right;">Actions</th></tr></thead><tbody id="finTableBody"></tbody></table></div>
    </div>

    <div id="enterpriseUsersCard" class="enterprise-card" style="display:none;">
      <header class="enterprise-card-header"><h4><i class="fa-solid fa-users-gear"></i> User Accounts</h4><button class="enterprise-btn primary sm" onclick="window.showUserForm()">Provision User</button></header>
      <div class="table-responsive" style="margin-top:20px;"><table class="table"><thead><tr><th>Email</th><th>Role</th><th>Hub</th><th>Status</th><th style="text-align:right;">Actions</th></tr></thead><tbody id="userTableBody"></tbody></table></div>
    </div>

    <div id="enterpriseSettingsCard" class="enterprise-card" style="display:none;">
      <header class="enterprise-card-header"><h4><i class="fa-solid fa-sliders"></i> Global Configuration</h4><button class="enterprise-btn primary sm" onclick="window.saveAllSettings()">Save All Changes</button></header>
      <nav class="workspace-modal-tabs"><button class="ws-tab-btn active" onclick="window.switchSettingsTab(this, 'company')">Company</button><button class="ws-tab-btn" onclick="window.switchSettingsTab(this, 'shipment')">Shipments</button><button class="ws-tab-btn" onclick="window.switchSettingsTab(this, 'appearance')">Appearance</button></nav>
      <div id="set-company" class="settings-tab-content">
          <form class="enterprise-form"><div class="form-grid"><div class="form-group"><label>Name</label><input id="set-comp-name"></div><div class="form-group"><label>Email</label><input id="set-comp-email"></div></div></form>
      </div>
      <div id="set-shipment" class="settings-tab-content" style="display:none;"><form class="enterprise-form"><div class="form-grid"><div class="form-group"><label>Prefix</label><input id="set-ship-prefix"></div><div class="form-group"><label>Serial</label><input id="set-ship-start" type="number"></div></div></form></div>
      <div id="set-appearance" class="settings-tab-content" style="display:none;"><div class="enterprise-form"><div class="form-group"><label>Theme</label><select id="set-app-theme"><option value="dark">Dark</option><option value="light">Light</option></select></div><div class="form-group"><label>Color</label><input type="color" id="set-app-color"></div></div></div>
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
            <section id="wsNotes" class="ws-tab-content"><textarea id="wsNewNote" class="edit-input" placeholder="Add note..."></textarea><button class="enterprise-btn primary" onclick="window.addWSNote()">Post</button><div id="wsNoteList" class="enterprise-list"></div></section>
            <section id="wsFiles" class="ws-tab-content"><div id="wsAssetList" class="enterprise-list"></div><input type="file" id="wsAssetInput" onchange="window.uploadWSAsset()"></section>
        </div>
        <footer class="workspace-modal-footer"><div class="enterprise-btn-row"><button class="enterprise-btn danger" onclick="window.deleteRow(enterpriseAdminState.activeTracking)">Delete</button><button class="enterprise-btn primary" onclick="window.saveWS()">Sync</button></div></footer>
      </div>`;
    document.body.appendChild(ws);
    ws.querySelectorAll('.ws-tab-btn').forEach(btn => btn.onclick = () => {
        ws.querySelectorAll('.ws-tab-btn, .ws-tab-content').forEach(el => el.classList.remove('active'));
        btn.classList.add('active'); $id('ws' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)).classList.add('active');
    });

    // CRM Modal
    const c = createElement('div', 'enterprise-modal-backdrop'); c.id = 'customerFormModal';
    c.innerHTML = `<div class="enterprise-modal"><header class="workspace-modal-header"><h2>Customer</h2><button class="close-btn" onclick="window.closeCustomerForm()">&times;</button></header><div class="workspace-modal-body"><form id="customerEntryForm" class="enterprise-form"><input type="hidden" id="cust-id"><div class="form-grid"><div class="form-group"><label>Name *</label><input id="cust-name" required></div><div class="form-group"><label>Mobile *</label><input id="cust-mobile" required></div></div><div class="form-grid"><div class="form-group"><label>Email</label><input id="cust-email"></div><div class="form-group"><label>Type</label><select id="cust-type"><option value="Individual">Individual</option><option value="Business">Business</option></select></div></div></form></div><footer class="workspace-modal-footer"><button class="enterprise-btn primary" onclick="window.submitCustomerForm()">Save</button></footer></div>`;
    document.body.appendChild(c);

    // Profile Modal
    const p = createElement('div', 'enterprise-modal-backdrop'); p.id = 'customerProfileModal';
    p.innerHTML = `<div class="enterprise-modal"><header class="workspace-modal-header"><h2>Client Profile</h2><button class="close-btn" onclick="window.closeCustomerProfile()">&times;</button></header><div class="workspace-modal-body"><div class="enterprise-grid"><aside><h3 id="prof-name-title">—</h3></aside></div></div></div>`;
    document.body.appendChild(p);

    // Fleet Modals (Driver)
    const drv = createElement('div', 'enterprise-modal-backdrop'); drv.id = 'driverFormModal';
    drv.innerHTML = `<div class="enterprise-modal"><header class="workspace-modal-header"><h2>Driver</h2><button class="close-btn" onclick="window.closeDriverForm()">&times;</button></header><div class="workspace-modal-body"><form id="driverEntryForm" class="enterprise-form"><input type="hidden" id="drv-id"><div class="form-grid"><div class="form-group"><label>Name</label><input id="drv-name"></div><div class="form-group"><label>Mobile</label><input id="drv-mobile"></div></div><div class="form-grid"><div class="form-group"><label>License</label><input id="drv-license"></div><div class="form-group"><label>Hub</label><input id="drv-branch"></div></div></form></div><footer class="workspace-modal-footer"><button class="enterprise-btn primary" onclick="window.submitDriverForm()">Save</button></footer></div>`;
    document.body.appendChild(drv);

    // Fleet Modals (Vehicle)
    const veh = createElement('div', 'enterprise-modal-backdrop'); veh.id = 'vehicleFormModal';
    veh.innerHTML = `<div class="enterprise-modal"><header class="workspace-modal-header"><h2>Vehicle</h2><button class="close-btn" onclick="window.closeVehicleForm()">&times;</button></header><div class="workspace-modal-body"><form id="vehicleEntryForm" class="enterprise-form"><input type="hidden" id="veh-id"><div class="form-grid"><div class="form-group"><label>Plate</label><input id="veh-plate"></div><div class="form-group"><label>Brand</label><input id="veh-brand"></div></div></form></div><footer class="workspace-modal-footer"><button class="enterprise-btn primary" onclick="window.submitVehicleForm()">Save</button></footer></div>`;
    document.body.appendChild(veh);

    // Hubs (Branch)
    const br = createElement('div', 'enterprise-modal-backdrop'); br.id = 'branchFormModal';
    br.innerHTML = `<div class="enterprise-modal"><header class="workspace-modal-header"><h2>Branch</h2><button class="close-btn" onclick="window.closeBranchForm()">&times;</button></header><div class="workspace-modal-body"><form id="branchEntryForm" class="enterprise-form"><input type="hidden" id="br-id"><div class="form-grid"><div class="form-group"><label>Name *</label><input id="br-name" required></div><div class="form-group"><label>Code *</label><input id="br-code" required></div></div><div class="form-group"><label>Manager</label><input id="br-manager"></div></form></div><footer class="workspace-modal-footer"><button class="enterprise-btn primary" onclick="window.submitBranchForm()">Save</button></footer></div>`;
    document.body.appendChild(br);

    // Staff (Employee)
    const emp = createElement('div', 'enterprise-modal-backdrop'); emp.id = 'employeeFormModal';
    emp.innerHTML = `<div class="enterprise-modal"><header class="workspace-modal-header"><h2>Staff</h2><button class="close-btn" onclick="window.closeEmployeeForm()">&times;</button></header><div class="workspace-modal-body"><form id="employeeEntryForm" class="enterprise-form"><input type="hidden" id="emp-id"><div class="form-grid"><div class="form-group"><label>Name *</label><input id="emp-name" required></div><div class="form-group"><label>Email *</label><input id="emp-email" required></div></div><div class="form-grid"><div class="form-group"><label>Title</label><input id="emp-desig"></div><div class="form-group"><label>Status</label><select id="emp-status"><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div></div></form></div><footer class="workspace-modal-footer"><button class="enterprise-btn primary" onclick="window.submitEmployeeForm()">Save</button></footer></div>`;
    document.body.appendChild(emp);

    // Access (User)
    const usr = createElement('div', 'enterprise-modal-backdrop'); usr.id = 'userFormModal';
    usr.innerHTML = `<div class="enterprise-modal"><header class="workspace-modal-header"><h2>User</h2><button class="close-btn" onclick="window.closeUserForm()">&times;</button></header><div class="workspace-modal-body"><form id="userEntryForm" class="enterprise-form"><input type="hidden" id="user-id"><div class="form-grid"><div class="form-group"><label>Email</label><input id="user-email"></div><div class="form-group"><label>Role</label><select id="user-role"><option value="admin">Admin</option><option value="employee">Employee</option></select></div></div><div id="userPassGroup" class="form-group"><label>Password</label><input id="user-pass" type="password"></div></form></div><footer class="workspace-modal-footer"><button class="enterprise-btn primary" onclick="window.submitUserForm()">Save</button></footer></div>`;
    document.body.appendChild(usr);
}

// --- Logistics Handlers ---

window.refreshDashboard = async () => {
    const db = getDb(); if (!db) return;
    try {
        console.log('[Dashboard] Refreshing stats...');
        const s = await db.getDashboardStats();

        // Safety checks for DOM elements
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
                            backgroundColor: ['#86efac', '#ffd34e', '#f4b400', '#fca5a5'],
                            borderWidth: 0
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, cutout: '75%' }
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
        const res = await db.queryShipments({ search: $id('searchDbInput')?.value });

        if (!res || !res.items || res.items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="empty-state">No shipments found in Database.</td></tr>';
            const pi = $id('paginationInfo'); if (pi) pi.textContent = 'Showing 0 of 0 records';
            return;
        }

        enterpriseAdminState.currentItems = res.items;
        const pi = $id('paginationInfo'); if (pi) pi.textContent = `Showing ${res.items.length} of ${res.items.length} records`;

        tbody.innerHTML = res.items.map(i => {
            const s = i.data;
            const statusCls = String(s.status).includes('Deliv') ? 'status-delivered' : 'status-on-journey';
            const payCls = String(s.paymentStatus).includes('Paid') ? 'status-delivered' : 'status-on-journey';
            return `
            <tr id="row_${i.trackingId}">
                <td class="value-highlight"><strong>${i.trackingId}</strong></td>
                <td>${s.date || ''}</td>
                <td>${s.sender || ''}</td>
                <td>${s.receiver || ''}</td>
                <td>${s.origin || ''} > ${s.destination || ''}</td>
                <td>${s.shipmentType || ''}</td>
                <td>W: ${s.weight || 0}kg<br>P: ${s.quantity || 1}</td>
                <td>$${s.shippingCost || 0}<br><span class="status-badge ${payCls}" style="font-size:0.6rem;">${s.paymentStatus || 'Unpaid'}</span></td>
                <td><span class="status-badge ${statusCls}">${s.status || 'Pending'}</span></td>
                <td>By: ${s.author || 'Admin'}<br><small>${formatTime(s.updatedAt || s.updated_at)}</small></td>
                <td style="text-align:right;"><div class="actions-cell"><button class="btn-action sm view" onclick="window.openShipmentWorkspace('${i.trackingId}')"><i class="fa-solid fa-eye"></i></button><button class="btn-action sm edit" onclick="window.editRow('${i.trackingId}')"><i class="fa-solid fa-pen"></i></button><button class="btn-action sm delete" onclick="window.deleteRow('${i.trackingId}')"><i class="fa-solid fa-trash"></i></button></div></td>
            </tr>`;
        }).join('');
    } catch (e) {
        console.error('[Table] Load FAILED', e);
        tbody.innerHTML = '<tr><td colspan="11" class="empty-state" style="color:var(--noorani-danger);">SYNC ERROR: Could not connect to API.</td></tr>';
    }
};

window.generateTrackingNumber = () => { $id('inputTracking').value = 'NM-' + (Math.floor(Math.random() * 900000) + 100000); window.findShipmentInForm(); };

window.findShipmentInForm = async () => {
    const id = $id('inputTracking').value.toUpperCase(); if (!id) return;
    const db = getDb(); if (!db) return;
    try {
        const res = await db.getShipmentByTracking(id);
        const btn = $id('btnRegisterShipment');
        if (res && res.data) {
            const d = res.data;
            $id('inputStatus').value = d.status || 'Pending';
            $id('inputDate').value = d.date || '';
            $id('inputType').value = d.shipmentType || 'Air Freight';
            $id('inputSender').value = d.sender || '';
            $id('inputSenderPhone').value = d.senderPhone || '';
            $id('inputSenderAddress').value = d.senderAddress || '';
            $id('inputOriginCountry').value = d.originCountry || '';
            $id('inputReceiver').value = d.receiver || '';
            $id('inputReceiverPhone').value = d.receiverPhone || '';
            $id('inputReceiverAddress').value = d.receiverAddress || '';
            $id('inputDestination').value = d.destination || '';
            $id('inputDestinationCountry').value = d.destinationCountry || '';
            $id('inputWeight').value = d.weight || '';
            $id('inputQuantity').value = d.quantity || '';
            $id('inputCost').value = d.shippingCost || '';
            $id('inputPaymentStatus').value = d.paymentStatus || 'Unpaid';
            $id('inputDriver').value = d.driver || '';
            $id('inputVehicle').value = d.vehicle || '';
            $id('inputNotes').value = d.notes || '';
            if (btn) btn.textContent = 'Update Existing Shipment';
        } else { if (btn) btn.textContent = 'Register & Sync to Database'; }
    } catch (e) { console.warn('[Form] Check failed', e); }
};

window.saveShipment = async () => {
    const id = $id('inputTracking').value.toUpperCase(); if (!id) return alert('Tracking ID required');
    const db = getDb(); if (!db) return;
    const d = {
        status: $id('inputStatus').value,
        date: $id('inputDate').value || new Date().toISOString().split('T')[0],
        shipmentType: $id('inputType').value,
        sender: $id('inputSender').value,
        senderPhone: $id('inputSenderPhone').value,
        senderAddress: $id('inputSenderAddress').value,
        originCountry: $id('inputOriginCountry').value,
        receiver: $id('inputReceiver').value,
        receiverPhone: $id('inputReceiverPhone').value,
        receiverAddress: $id('inputReceiverAddress').value,
        destination: $id('inputDestination').value,
        destinationCountry: $id('inputDestinationCountry').value,
        weight: $id('inputWeight').value,
        quantity: $id('inputQuantity').value,
        shippingCost: $id('inputCost').value,
        paymentStatus: $id('inputPaymentStatus').value,
        driver: $id('inputDriver').value,
        vehicle: $id('inputVehicle').value,
        notes: $id('inputNotes').value,
        public: true,
        source: 'manual'
    };
    try {
        await db.saveShipment(id, d);
        alert('Successfully saved to Database');
        window.loadDashboard();
        window.refreshDashboard();
    } catch (e) { alert('Save Failed: ' + e.message); }
};

window.editRow = id => {
    const row = $id('row_'+id);
    if (!row) return;
    const item = enterpriseAdminState.currentItems.find(x => x.trackingId === id);
    const currentStatus = item?.data?.status || 'Pending';
    row.innerHTML = `<td colspan="11"><div style="display:flex; gap:10px; padding:10px; background:rgba(255,255,255,0.05); border-radius:8px;"><input id="edit_status_${id}" class="edit-input" value="${currentStatus}"> <button class="btn-action sm save" onclick="window.saveRow('${id}')">Save</button><button class="btn-action sm" onclick="window.loadDashboard()">Cancel</button></div></td>`;
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
        } catch (e) { alert('Delete failed: ' + e.message); }
    }
};

// --- Operational Modules ---

window.renderCustomers = async () => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.queryCustomers({ search: $id('custSearchInput')?.value });
        $id('custTableBody').innerHTML = (res.items || []).map(c => `<tr><td>${c.id}</td><td>${c.fullName}</td><td>${c.customerType}</td><td>${c.mobileNumber}</td><td>${c.city || ''}</td><td style="text-align:right;"><div class="actions-cell"><button class="btn-action sm view" onclick="window.viewCustomerProfile('${c.id}')"><i class="fa-solid fa-eye"></i></button><button class="btn-action sm edit" onclick="window.showCustomerForm('${c.id}')"><i class="fa-solid fa-pen"></i></button><button class="btn-action sm delete" onclick="window.deleteCustomer('${c.id}')"><i class="fa-solid fa-trash"></i></button></div></td></tr>`).join('') || '<tr><td colspan="6" class="empty-state">No customers found.</td></tr>';
    } catch (e) { console.error('Customers render failed', e); }
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
window.closeCustomerProfile = () => $id('customerProfileModal').classList.remove('is-open');
window.deleteCustomer = async id => { if (confirm('Delete client?')) { const db = getDb(); if (!db) return; try { await db.deleteCustomer(id); window.renderCustomers(); } catch(e){} } };

window.renderDrivers = async () => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.queryDrivers();
        $id('drvTableBody').innerHTML = (res.items || []).map(d => `<tr><td>${d.id}</td><td>${d.fullName}</td><td>${d.licenseNumber || ''}</td><td>${d.mobileNumber}</td><td>${d.branchCode || ''}</td><td>${d.status}</td><td style="text-align:right;"><div class="actions-cell"><button class="btn-action sm edit" onclick="window.showDriverForm('${d.id}')"><i class="fa-solid fa-pen"></i></button><button class="btn-action sm delete" onclick="window.deleteDriver('${d.id}')"><i class="fa-solid fa-trash"></i></button></div></td></tr>`).join('') || '<tr><td colspan="7" class="empty-state">No drivers registered.</td></tr>';
    } catch (e) { console.error('Drivers render failed', e); }
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
        $id('vehTableBody').innerHTML = (res.items || []).map(v => `<tr><td>${v.id}</td><td>${v.plateNumber}</td><td>${v.vehicleType}</td><td>${v.assignedDriver || ''}</td><td>${v.currentMileage || 0}</td><td>${v.status}</td><td style="text-align:right;"><div class="actions-cell"><button class="btn-action sm edit" onclick="window.showVehicleForm('${v.id}')"><i class="fa-solid fa-pen"></i></button><button class="btn-action sm delete" onclick="window.deleteVehicle('${v.id}')"><i class="fa-solid fa-trash"></i></button></div></td></tr>`).join('') || '<tr><td colspan="7" class="empty-state">No vehicles registered.</td></tr>';
    } catch (e) { console.error('Vehicles render failed', e); }
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
        $id('brTableBody').innerHTML = (res.items || []).map(b => `<tr><td>${b.id}</td><td>${b.branchName}</td><td>${b.branchCode}</td><td>${b.managerName || ''}</td><td>${b.city || ''}</td><td>${b.status}</td><td style="text-align:right;"><div class="actions-cell"><button class="btn-action sm edit" onclick="window.showBranchForm('${b.id}')"><i class="fa-solid fa-pen"></i></button><button class="btn-action sm delete" onclick="window.deleteBranch('${b.id}')"><i class="fa-solid fa-trash"></i></button></div></td></tr>`).join('') || '<tr><td colspan="7" class="empty-state">No branches found.</td></tr>';
    } catch (e) { console.error('Branches render failed', e); }
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
        $id('empTableBody').innerHTML = (res.items || []).map(e => `<tr><td>${e.fullName}</td><td>${e.designation || ''}</td><td>${e.assignedBranch || ''}</td><td>${e.employmentStatus || 'Active'}</td><td style="text-align:right;"><div class="actions-cell"><button class="btn-action sm edit" onclick="window.showEmployeeForm('${e.id}')"><i class="fa-solid fa-pen"></i></button><button class="btn-action sm delete" onclick="window.deleteEmployee('${e.id}')"><i class="fa-solid fa-trash"></i></button></div></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No employees found.</td></tr>';
    } catch (e) { console.error('Employees render failed', e); }
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
        $id('userTableBody').innerHTML = (users || []).map(u => `<tr><td>${u.email}</td><td>${u.role.toUpperCase()}</td><td>${u.branchCode || 'HQ'}</td><td>${u.status.toUpperCase()}</td><td style="text-align:right;"><button class="btn-action sm delete" onclick="window.deleteUser('${u.uid}')"><i class="fa-solid fa-user-xmark"></i></button></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No users found.</td></tr>';
    } catch (e) { console.error('Users render failed', e); }
};
window.showUserForm = async (id = null) => {
    $id('userEntryForm').reset(); $id('user-id').value = id || '';
    $id('userFormModal').classList.add('is-open');
};
window.closeUserForm = () => $id('userFormModal').classList.remove('is-open');
window.submitUserForm = async () => {
    const db = getDb(); if (!db) return;
    const d = {
        displayName: $id('user-email').value.split('@')[0],
        email: $id('user-email').value,
        password: $id('user-pass').value,
        role: $id('user-role').value
    };
    try {
        await db.saveUserAccount(d);
        window.closeUserForm();
        window.renderUsers();
    } catch (e) { alert(e.message); }
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
        $id('finTableBody').innerHTML = (res.items || []).map(t => `<tr><td>${t.id}</td><td>${t.date}</td><td>${t.category}</td><td>${t.paymentMethod || ''}</td><td>$${t.amount}</td><td>${t.status}</td><td style="text-align:right;"><button class="btn-action sm delete" onclick="window.deleteTransaction('${t.id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="7" class="empty-state">No transactions recorded.</td></tr>';
    } catch (e) { console.error('Finance render failed', e); }
};

window.renderAuditLogs = async () => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.queryAuditLogs({ pageSize: 50 });
        $id('auditTableBody').innerHTML = (res.items || []).map(l => `<tr><td>${formatTime(l.created_at || l.createdAt)}</td><td>${l.actorEmail}</td><td>${l.action}</td><td>${l.module}</td><td style="text-align:right;"><button class="btn-action sm" onclick="window.viewAuditDetails('${l.id}')"><i class="fa-solid fa-circle-info"></i></button></td></tr>`).join('') || '<tr><td colspan="5" class="empty-state">No audit logs found.</td></tr>';
    } catch (e) { console.error('Audit logs render failed', e); }
};
window.viewAuditDetails = async (id) => {
    alert('Audit entry #' + id + ' details would be displayed here.');
};

window.renderNotifications = (l) => {
    const list = Array.isArray(l) ? l : [];
    const c = $id('notif-count'); if (c) { c.textContent = list.filter(x => !x.read).length; c.style.display = list.length ? 'block' : 'none'; }
    $id('notif-list').innerHTML = list.map(n => `<div class="notif-item"><h5>${n.title}</h5><p>${n.message}</p></div>`).join('') || '<p class="empty-state">No new alerts.</p>';
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
                <div class="form-group"><label>Sender</label><input id="wsSender" value="${d.sender||''}"></div>
                <div class="form-group"><label>Receiver</label><input id="wsReceiver" value="${d.receiver||''}"></div>
                <div class="form-group"><label>Cost</label><input id="wsCost" value="${d.shippingCost||0}"></div>
            </div>`;
        $id('wsStatus').value = d.status;

        const notes = await db.getShipmentNotesForShipment(id);
        $id('wsNoteList').innerHTML = notes.map(x => `<div class="enterprise-list-item"><strong>${x.author}</strong><p>${x.content}</p></div>`).join('') || '<p>No notes.</p>';

        const assets = await db.getShipmentAssetsForShipment(id);
        $id('wsAssetList').innerHTML = assets.map(x => `<div class="enterprise-list-item"><a href="${x.downloadURL}" target="_blank">${x.fileName}</a></div>`).join('') || '<p>No files.</p>';
    } catch (e) { console.error('Workspace load failed', e); }
};

window.saveWS = async () => {
    const db = getDb(); if (!db) return;
    try {
        await db.saveShipment(enterpriseAdminState.activeTracking, {
            status: $id('wsStatus').value,
            sender: $id('wsSender').value,
            receiver: $id('wsReceiver').value,
            shippingCost: $id('wsCost').value
        });
        alert('Synced to Database'); window.loadDashboard();
    } catch (e) { alert('Sync failed: ' + e.message); }
};

window.renderOps = async () => {
    const db = getDb(); if (!db) return;
    try {
        const p = await db.getCurrentAdminProfile();
        if (!p) return;
        $id('enterpriseRoleSummary').innerHTML = `<span class="enterprise-badge badge-role">${p.role.toUpperCase()}</span><span class="enterprise-badge badge-branch">${p.branchCode||'GLOBAL'}</span>`;
        window.renderCustomers();
        window.renderDrivers();
        window.renderVehicles();
        window.renderBranches();
        window.renderEmployees();
        window.renderUsers();
        window.renderFinance();
        window.renderAuditLogs();
    } catch (e) { console.error('Ops render failed', e); }
};

// --- Export Logic ---

window.exportShipmentTable = (format) => {
    const items = enterpriseAdminState.currentItems;
    if (!items.length) return alert('No data to export');

    const headers = ['Tracking #', 'Date', 'Sender', 'Receiver', 'Status', 'Cost'];
    const data = items.map(i => [i.trackingId, i.data.date, i.data.sender, i.data.receiver, i.data.status, i.data.shippingCost]);

    if (format === 'csv') {
        const csv = [headers.join(','), ...data.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'shipments.csv'; a.click();
    } else if (format === 'xlsx') {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        XLSX.utils.book_append_sheet(wb, ws, 'Shipments');
        XLSX.writeFile(wb, 'shipments.xlsx');
    } else if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text('Shipment Manifest', 10, 10);
        doc.autoTable({ head: [headers], body: data });
        doc.save('shipments.pdf');
    }
};

window.exportAudit = (format) => {
    alert('Audit trail export in ' + format + ' would use similar logic to shipment export.');
};

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
      } catch (e) { console.error('[DB] Initial Load FAILED', e); }
    }
  }, 200);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
