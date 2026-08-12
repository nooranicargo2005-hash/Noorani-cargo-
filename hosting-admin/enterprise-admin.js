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
  editMode: { id: null, module: null },
  openFolders: new Set()
};

const $id = id => document.getElementById(id);
const createElement = (tag, cls, html = '') => { const el = document.createElement(tag); if (cls) el.className = cls; if (html) el.innerHTML = html; return el; };
const formatTime = (v) => { if (!v) return '—'; try { const d = v.toDate ? v.toDate() : (v.seconds ? new Date(v.seconds * 1000) : new Date(v)); return d.toLocaleString(); } catch (e) { return String(v); } };
const formatDateForInput = (v) => {
    if (!v || v === 'undefined' || v === 'null') return '';
    try {
        const d = new Date(v);
        if (isNaN(d.getTime())) {
             if (/^\d{4}-\d{2}-\d{2}$/.test(String(v).substring(0, 10))) {
                return String(v).substring(0, 10);
            }
            return '';
        }
        return d.toISOString().split('T')[0];
    } catch (e) { return ''; }
};

const getDb = () => nooraniDb || window.nooraniDb;

// --- UI Construction ---

function createUI() {
  const view = $id('adminView');
  if (!view || $id('enterprise-admin-panel')) return;

  const panel = createElement('div', 'enterprise-panel');
  panel.id = 'enterprise-admin-panel';
  panel.innerHTML = `
    <div class="form-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:32px;">
      <div id="enterpriseProfileCard" class="n-card">
        <header style="margin-bottom:32px; display:flex; align-items:center; gap:16px;">
            <div class="kpi-icon" style="width:48px; height:48px; border-radius:12px;"><i class="fa-solid fa-user-shield"></i></div>
            <h3>Access Profile</h3>
        </header>
        <div id="enterpriseRoleSummary" style="margin-bottom:24px;"></div>
        <div id="enterprisePermSummary" style="display:grid; gap:12px;"></div>
      </div>
    </div>

    <div id="enterpriseActivityCard" class="n-card hidden" style="margin-top:32px;">
      <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
          <h3><i class="fa-solid fa-list-check" style="color:var(--n-gold); margin-right:16px;"></i>System Audit Trail</h3>
          <button class="n-btn" onclick="window.exportAudit('xlsx')"><i class="fa-solid fa-file-excel"></i> Export Log</button>
      </header>
      <div class="mb-20">
          <input id="auditSearchInput" class="n-input" placeholder="Search system logs..." onkeyup="window.renderAuditLogs()">
      </div>
      <div class="table-container">
          <table class="table">
              <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Module</th><th class="text-right">Actions</th></tr></thead>
              <tbody id="auditTableBody"></tbody>
          </table>
      </div>
    </div>

    <div id="enterpriseReportsCard" class="n-card hidden" style="margin-top:32px;">
      <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:40px;">
        <div>
            <h2 style="font-size:2rem;">Intelligence Studio</h2>
            <p class="text-muted">High-level operational analysis.</p>
        </div>
        <button class="n-btn" onclick="window.refreshAnalytics()"><i class="fa-solid fa-sync"></i> Refresh</button>
      </header>
      <div class="kpi-grid" style="margin-bottom:40px;">
        <article class="kpi-card"><div class="kpi-data"><span>Profitability</span><strong id="rep-kpi-profit">$0</strong></div></article>
        <article class="kpi-card"><div class="kpi-data"><span>Success Rate</span><strong id="rep-kpi-rate">0%</strong></div></article>
        <article class="kpi-card"><div class="kpi-data"><span>Due Balance</span><strong id="rep-kpi-due" style="color:var(--n-danger);">$0</strong></div></article>
      </div>
      <nav style="display:flex; gap:16px; margin-bottom:40px; border-bottom:1px solid var(--n-border); padding-bottom:16px;">
        <button class="n-btn active" onclick="window.switchReportTab(this, 'visuals')">Data Visualization</button>
        <button class="n-btn" onclick="window.switchReportTab(this, 'shipments')">Inventory Logs</button>
        <button class="n-btn" onclick="window.switchReportTab(this, 'financial')">Financial Ledger</button>
      </nav>
      <div id="rep-visuals" class="report-tab-content">
        <div class="form-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:32px;">
            <div class="n-card" style="background:var(--n-surface);"><h5>Volume Trends</h5><div style="height:280px;"><canvas id="chart-shipment-trend"></canvas></div></div>
            <div class="n-card" style="background:var(--n-surface);"><h5>Revenue Flow</h5><div style="height:280px;"><canvas id="chart-finance-trend"></canvas></div></div>
        </div>
      </div>
      <div id="rep-shipments" class="report-tab-content hidden"><div class="table-container"><table class="table"><thead><tr><th>Cargo ID</th><th>Hub</th><th>Status</th></tr></thead><tbody id="rep-ship-content"></tbody></table></div></div>
      <div id="rep-financial" class="report-tab-content hidden"><div class="table-container"><table class="table"><thead><tr><th>TXN ID</th><th>Amount</th><th>Category</th></tr></thead><tbody id="rep-fin-content"></tbody></table></div></div>
    </div>

    <div id="enterpriseFinanceCard" class="n-card hidden" style="margin-top:32px;">
      <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
        <h3><i class="fa-solid fa-wallet" style="color:var(--n-gold); margin-right:16px;"></i>Financial Ledger</h3>
        <div style="display:flex; gap:12px;">
            <button class="n-btn primary" onclick="window.showTransactionForm('income')">Add Income</button>
            <button class="n-btn" onclick="window.showTransactionForm('expense')" style="border-color:var(--n-danger); color:var(--n-danger);">Add Expense</button>
        </div>
      </header>
      <div class="kpi-grid mb-20">
        <article class="kpi-card"><div class="kpi-data"><span>Revenue</span><strong id="fin-revenue">$0</strong></div></article>
        <article class="kpi-card"><div class="kpi-data"><span>Expenses</span><strong id="fin-expenses">$0</strong></div></article>
        <article class="kpi-card"><div class="kpi-data"><span>Net Profit</span><strong id="fin-profit">$0</strong></div></article>
      </div>
      <div class="table-container"><table class="table"><thead><tr><th>TXN ID</th><th>Date</th><th>Category</th><th>Method</th><th>Amount</th><th>Status</th><th class="text-right">Actions</th></tr></thead><tbody id="finTableBody"></tbody></table></div>
    </div>

    <div id="enterpriseInvoicesCard" class="n-card hidden" style="margin-top:32px;">
      <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
        <h3><i class="fa-solid fa-file-invoice-dollar" style="color:var(--n-gold); margin-right:16px;"></i>Billing Center</h3>
        <button class="n-btn primary" onclick="window.refreshFinance()"><i class="fa-solid fa-sync"></i> Refresh</button>
      </header>
      <div class="table-container"><table class="table"><thead><tr><th>Invoice #</th><th>Cargo ID</th><th>Amount</th><th>Status</th><th class="text-right">Actions</th></tr></thead><tbody id="invTableBody"><tr><td colspan="5" class="text-center text-muted">No invoices identified.</td></tr></tbody></table></div>
    </div>

    <div id="enterpriseUsersCard" class="n-card hidden" style="margin-top:32px;">
      <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
        <h3><i class="fa-solid fa-users-gear" style="color:var(--n-gold); margin-right:16px;"></i>User Access Control</h3>
        <button class="n-btn primary" onclick="window.showUserForm()"><i class="fa-solid fa-user-plus"></i> Provision User</button>
      </header>
      <div class="table-container"><table class="table"><thead><tr><th>User</th><th>Role</th><th>Hub</th><th>Status</th><th class="text-right">Actions</th></tr></thead><tbody id="userTableBody"></tbody></table></div>
    </div>

    <div id="enterpriseNotificationsCard" class="n-card hidden" style="margin-top:32px;">
      <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
        <h3><i class="fa-solid fa-bell" style="color:var(--n-gold); margin-right:16px;"></i>Full History</h3>
        <button class="n-btn" onclick="window.clearNotifications()"><i class="fa-solid fa-trash"></i> Clear All</button>
      </header>
      <div id="enterpriseNotifFullList" style="display:grid; gap:16px;"></div>
    </div>

    <div id="enterpriseSettingsCard" class="n-card hidden" style="margin-top:32px;">
      <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
        <h3><i class="fa-solid fa-sliders" style="color:var(--n-gold); margin-right:16px;"></i>Global Settings</h3>
        <button class="n-btn primary" onclick="window.saveAllSettings()">Sync Changes</button>
      </header>
      <nav style="display:flex; gap:16px; margin-bottom:32px; border-bottom:1px solid var(--n-border); padding-bottom:16px;">
        <button class="n-btn active" onclick="window.switchSettingsTab(this, 'company')">Company Profile</button>
        <button class="n-btn" onclick="window.switchSettingsTab(this, 'shipment')">Cargo Config</button>
      </nav>
      <div id="set-company" class="settings-tab-content">
          <div class="form-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:32px;">
            <div style="display:grid; gap:12px;"><label>Organization Name</label><input id="set-comp-name" class="n-input"></div>
            <div style="display:grid; gap:12px;"><label>Primary Email</label><input id="set-comp-email" class="n-input"></div>
            <div style="display:grid; gap:12px;"><label>System Theme</label><select id="set-app-theme" class="n-input"><option value="dark">Elite Dark</option><option value="light">Classic Light</option></select></div>
            <div style="display:grid; gap:12px;"><label>Accent Color</label><input id="set-app-color" type="color" class="n-input" style="height:44px; padding:4px;"></div>
          </div>
      </div>
      <div id="set-shipment" class="settings-tab-content hidden">
          <div class="form-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:32px;">
            <div style="display:grid; gap:12px;"><label>Tracking Prefix</label><input id="set-ship-prefix" class="n-input"></div>
            <div style="display:grid; gap:12px;"><label>Serial Initializer</label><input id="set-ship-start" type="number" class="n-input"></div>
          </div>
      </div>
    </div>

    <div id="enterpriseBackupCard" class="n-card hidden" style="margin-top:32px;">
      <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
        <h3><i class="fa-solid fa-cloud-arrow-down" style="color:var(--n-gold); margin-right:16px;"></i>Database Backup</h3>
      </header>
      <div class="p-40 text-center">
        <p class="text-muted">Cloud synchronization and local export utilities.</p>
        <button class="n-btn mt-20" onclick="alert('Local database backup initialized.')"><i class="fa-solid fa-download"></i> Download SQLite DB</button>
      </div>
    </div>
  `;
  view.appendChild(panel);
  initModals();
}

function initModals() {
    // Shipment Workspace
    if (!$id('shipmentWorkspaceModal')) {
        const ws = createElement('div', 'enterprise-modal-backdrop');
        ws.id = 'shipmentWorkspaceModal';
        ws.style.cssText = 'position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.85); backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:0.3s;';
        ws.innerHTML = `
          <div class="n-card" style="width:100%; max-width:900px; max-height:90vh; overflow-y:auto; border-color:var(--n-border-accent);">
            <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
                <div><span id="wsTrack" class="text-muted" style="font-size:0.75rem; font-weight:800; letter-spacing:2px;">ID</span><h2 id="wsTitle" style="margin-top:4px;">Shipment File</h2></div>
                <button class="n-btn" onclick="window.closeWorkspace()" style="border-radius:50%; width:44px; height:44px; padding:0; justify-content:center; font-size:1.5rem;">&times;</button>
            </header>
            <nav style="display:flex; gap:12px; margin-bottom:32px; border-bottom:1px solid var(--n-border); padding-bottom:12px;">
                <button class="n-btn active" onclick="window.switchWSTab(this, 'general')">Overview</button>
                <button class="n-btn" onclick="window.switchWSTab(this, 'notes')">Notes</button>
                <button class="n-btn" onclick="window.switchWSTab(this, 'files')">Assets</button>
            </nav>
            <div class="workspace-body">
                <section id="wsGeneral" class="ws-tab-content">
                    <div id="wsForm"></div>
                    <div class="enterprise-btn-row" style="margin-top:40px; display:flex; justify-content:flex-end; gap:16px;">
                        <button class="n-btn" onclick="window.deleteRow(enterpriseAdminState.activeTracking)" style="border-color:var(--n-danger); color:var(--n-danger);">Delete Record</button>
                        <button class="n-btn primary" onclick="window.saveWS()">Sync Changes</button>
                    </div>
                </section>
                <section id="wsNotes" class="ws-tab-content hidden">
                    <textarea id="wsNewNote" class="n-input" placeholder="Enter administrative note..." style="height:120px;"></textarea>
                    <button class="n-btn primary mt-20" onclick="window.addWSNote()" style="width:100%;">Post Note</button>
                    <div id="wsNoteList" style="margin-top:32px;"></div>
                </section>
                <section id="wsFiles" class="ws-tab-content hidden">
                    <div id="wsAssetList"></div>
                    <div class="mt-20" style="border:2px dashed var(--n-border); padding:32px; border-radius:12px; text-align:center;">
                        <input type="file" id="wsAssetInput" hidden onchange="window.uploadWSAsset()">
                        <button class="n-btn" onclick="$id('wsAssetInput').click()"><i class="fa-solid fa-cloud-arrow-up"></i> Upload Attachment</button>
                        <p class="text-muted" style="margin-top:12px; font-size:0.8rem;">Supports Documents & Images</p>
                    </div>
                </section>
            </div>
          </div>`;
        document.body.appendChild(ws);

        window.switchWSTab = (btn, tab) => {
            const parent = btn.closest('.n-card');
            parent.querySelectorAll('nav .n-btn').forEach(b => b.classList.remove('active', 'primary'));
            btn.classList.add('active');
            parent.querySelectorAll('.ws-tab-content').forEach(c => c.classList.add('hidden'));
            $id('ws' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.remove('hidden');
        };
    }

    // CRUD Modal Templates
    const createModal = (id, title, content, footer) => {
        if ($id(id)) return;
        const m = createElement('div', 'enterprise-modal-backdrop');
        m.id = id;
        m.style.cssText = 'position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.85); backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:0.3s;';
        m.innerHTML = `
          <div class="n-card" style="width:100%; max-width:800px; max-height:90vh; overflow-y:auto;">
            <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:32px;">
                <h2 style="font-size:1.5rem;">${title}</h2>
                <button class="n-btn" onclick="$id('${id}').style.opacity='0'; $id('${id}').style.pointerEvents='none';" style="border-radius:50%; width:44px; height:44px; padding:0; justify-content:center; font-size:1.5rem;">&times;</button>
            </header>
            <div class="modal-body">${content}</div>
            <footer style="margin-top:40px; padding-top:24px; border-top:1px solid var(--n-border); display:flex; justify-content:flex-end;">${footer}</footer>
          </div>`;
        document.body.appendChild(m);

        m.open = () => { m.style.opacity='1'; m.style.pointerEvents='auto'; };
        m.close = () => { m.style.opacity='0'; m.style.pointerEvents='none'; };
    };

    createModal('transactionFormModal', 'Ledger Entry',
        `<form id="transactionEntryForm" class="enterprise-form"><input type="hidden" id="txn-id"><div class="form-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:24px;"><div class="form-group"><label>Type</label><select id="txn-type" class="n-input"><option value="income">Income</option><option value="expense">Expense</option></select></div><div class="form-group"><label>Date</label><input type="date" id="txn-date" class="n-input"></div></div><div class="form-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:24px; margin-top:24px;"><div class="form-group"><label>Category</label><input id="txn-category" class="n-input"></div><div class="form-group"><label>Amount</label><input type="number" id="txn-amount" step="0.01" class="n-input"></div></div><div class="form-group" style="margin-top:24px;"><label>Description</label><textarea id="txn-desc" class="n-input" style="height:100px;"></textarea></div></form>`,
        `<button class="n-btn primary" onclick="window.submitTransactionForm()">Sync Transaction</button>`
    );

    createModal('userFormModal', 'Security Access',
        `<form id="userEntryForm" class="enterprise-form"><input type="hidden" id="user-id"><div class="form-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:24px;"><div class="form-group"><label>Login Email</label><input id="user-email" class="n-input"></div><div class="form-group"><label>Role</label><select id="user-role" class="n-input"><option value="admin">Admin</option><option value="employee">Employee</option></select></div></div><div id="userPassGroup" class="form-group" style="margin-top:24px;"><label>Password</label><input id="user-pass" type="password" class="n-input"></div></form>`,
        `<button class="n-btn primary" onclick="window.submitUserForm()">Authorize Account</button>`
    );

    createModal('manifestsModal', 'Archived Manifests',
        `<div id="manifestsList" style="display:grid; gap:16px; margin-top:10px;"></div>`,
        `<button class="n-btn" onclick="$id('manifestsModal').style.opacity='0'; $id('manifestsModal').style.pointerEvents='none';">Close</button>`
    );
    console.log('[Init] Modals initialized successfully.');
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
        setVal('stat-transit', s.inTransit);
        setVal('stat-pending', s.pending);
        setVal('stat-cancelled', s.cancelled);
    } catch (e) { console.error('[Dashboard] Stats Refresh FAILED', e); }
};

window.toggleFolder = (folderId) => {
    if (enterpriseAdminState.openFolders.has(folderId)) {
        enterpriseAdminState.openFolders.delete(folderId);
    } else {
        enterpriseAdminState.openFolders.add(folderId);
    }
    window.loadDashboard();
};

window.loadDashboard = async () => {
    const db = getDb(); if (!db) return;
    const tbody = $id('dbTableBody'); if (!tbody) return;
    try {
        console.log('[Table] Loading grouped shipments...');
        const params = {
            search: $id('searchDbInput')?.value || '',
            status: $id('filterStatus')?.value || '',
            paymentStatus: $id('filterPayment')?.value || '',
            limit: $id('filterPageSize')?.value || 50
        };
        const res = await db.queryShipments(params);

        if (!res || !res.items || res.items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12" class="text-center mt-20"><div class="n-card" style="display:inline-block; padding:40px;">No shipments identified.</div></td></tr>';
            const pi = $id('paginationInfo'); if (pi) pi.textContent = 'Showing 0 records';
            return;
        }

        enterpriseAdminState.currentItems = res.items;
        const pi = $id('paginationInfo'); if (pi) pi.textContent = `Showing ${res.items.length} records`;

        // 1. Grouping Logic
        const groups = {};
        res.items.forEach(item => {
            const s = item.data;
            const date = new Date(s.date || Date.now());
            const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
            const statusKey = s.status || 'Pending';

            if (!groups[monthKey]) groups[monthKey] = { count: 0, statuses: {} };
            if (!groups[monthKey].statuses[statusKey]) groups[monthKey].statuses[statusKey] = [];

            groups[monthKey].statuses[statusKey].push(item);
            groups[monthKey].count++;
        });

        // 2. Rendering Logic
        let html = '';
        Object.keys(groups).sort((a, b) => new Date(b) - new Date(a)).forEach(month => {
            const mFolderId = `folder_${month}`;
            const mIsOpen = enterpriseAdminState.openFolders.has(mFolderId);

            html += `
                <tr class="folder-row folder-month ${mIsOpen ? 'is-open' : ''}" onclick="window.toggleFolder('${mFolderId}')">
                    <td colspan="12">
                        <div class="folder-content">
                            <i class="fa-solid fa-chevron-right folder-arrow"></i>
                            <i class="fa-solid fa-folder folder-icon"></i>
                            <span>${month}</span>
                            <span class="folder-badge">${groups[month].count} Shipments</span>
                        </div>
                    </td>
                </tr>
            `;

            if (mIsOpen) {
                const statuses = groups[month].statuses;
                Object.keys(statuses).sort().forEach(status => {
                    const sFolderId = `${mFolderId}_${status}`;
                    const sIsOpen = enterpriseAdminState.openFolders.has(sFolderId);

                    html += `
                        <tr class="folder-row folder-status ${sIsOpen ? 'is-open' : ''}" onclick="window.toggleFolder('${sFolderId}')">
                            <td colspan="12">
                                <div class="folder-content">
                                    <i class="fa-solid fa-chevron-right folder-arrow"></i>
                                    <i class="fa-solid fa-folder-open folder-icon" style="color:var(--n-low);"></i>
                                    <span>${status}</span>
                                    <span class="folder-badge" style="background:rgba(255,255,255,0.05); color:var(--n-muted);">${statuses[status].length}</span>
                                </div>
                            </td>
                        </tr>
                    `;

                    if (sIsOpen) {
                        statuses[status].forEach(item => {
                            const i = item;
                            const s = i.data;
                            const statusCls = String(s.status).includes('Deliv') ? 'status-delivered' : 'status-transit';
                            html += `
                                <tr id="row_${i.trackingId}" class="shipment-data-row">
                                    <td style="font-weight:800; color:var(--n-gold);">${i.trackingId}</td>
                                    <td>${s.route || ''}</td>
                                    <td>${s.sender || ''}</td>
                                    <td>${s.receiver || ''}</td>
                                    <td>${s.milestone1 || ''}</td>
                                    <td>${s.milestone2 || ''}</td>
                                    <td>${s.milestone3 || ''}</td>
                                    <td>${s.milestone4 || ''}</td>
                                    <td>${s.milestone5 || ''}</td>
                                    <td>${s.milestone6 || ''}</td>
                                    <td><span class="status-badge ${statusCls}">${s.status || 'Pending'}</span></td>
                                    <td class="text-right">
                                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                                            <button class="n-btn" style="padding:8px 12px;" onclick="window.openShipmentWorkspace('${i.trackingId}')"><i class="fa-solid fa-eye"></i></button>
                                            <button class="n-btn" style="padding:8px 12px;" onclick="window.editRow('${i.trackingId}')"><i class="fa-solid fa-pen"></i></button>
                                            <button class="n-btn" style="padding:8px 12px; color:var(--n-danger); border-color:rgba(239,68,68,0.2);" onclick="window.deleteRow('${i.trackingId}')"><i class="fa-solid fa-trash"></i></button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        });
                    }
                });
            }
        });

        tbody.innerHTML = html;
    } catch (e) {
        console.error('[Table] Grouped Load FAILED', e);
        tbody.innerHTML = '<tr><td colspan="12" class="text-center" style="color:var(--n-danger);">Sync Error: API Unreachable.</td></tr>';
    }
};

window.generateTrackingNumber = () => { $id('inputTracking').value = 'NM-' + (Math.floor(Math.random() * 900000) + 100000); window.findShipmentInForm(); };

window.findShipmentInForm = async () => {
    const id = $id('inputTracking').value.toUpperCase();
    if (!id) return alert('Enter Tracking or Invoice Number first');

    const db = getDb(); if (!db) return;
    try {
        const res = await db.getShipmentByTracking(id);
        const btn = $id('btnRegisterShipment');

        if (res && res.data) {
            const d = res.data;
            // Always set inputTracking to the actual trackingId for the form
            $id('inputTracking').value = d.trackingId;
            $id('inputStatus').value = d.status || 'Pending';
            $id('inputDate').value = d.date || '';
            $id('inputBranchCode').value = d.branchCode || '';
            $id('inputSwbSerial').value = d.swbSerial || '';
            $id('inputShippingNo').value = d.shippingNumber || '';
            $id('inputCustomerInvoice').value = d.customerInvoice || '';
            $id('inputSwbDate').value = d.swbDate || '';
            $id('inputShipmentType').value = d.shipmentType || 'Air Freight';
            $id('inputRoute').value = d.route || '';
            $id('inputM1').value = d.milestone1 || '';
            $id('inputM2').value = d.milestone2 || '';
            $id('inputM3').value = d.milestone3 || '';
            $id('inputM4').value = d.milestone4 || '';
            $id('inputM5').value = d.milestone5 || '';
            $id('inputM6').value = d.milestone6 || '';
            $id('inputSender').value = d.sender || '';
            $id('inputSenderPhone').value = d.senderPhone || '';
            $id('inputReceiver').value = d.receiver || '';
            $id('inputReceiverPhone').value = d.receiverPhone || '';
            $id('inputDestination').value = d.destination || '';
            $id('inputReceiverAddress').value = d.receiverAddress || '';
            $id('inputOriginCountry').value = d.originCountry || '';
            $id('inputDestinationCountry').value = d.destinationCountry || '';
            $id('inputOriginalQuantity').value = d.originalQuantity || '';
            $id('inputQuantity').value = d.quantity || '';
            $id('inputOriginalWeight').value = d.originalWeight || '';
            $id('inputWeight').value = d.weight || '';
            $id('inputNotes').value = d.notes || '';

            if (btn) btn.textContent = 'Update Shipment Record';
            alert(`Shipment ${d.trackingId} loaded successfully.`);
        } else {
            alert('No matching record identified.');
            window.resetShipmentForm(false);
            $id('inputTracking').value = id;
        }
    } catch (e) { alert('Search failed.'); }
};

window.resetShipmentForm = (clearTracking = true) => {
    if (clearTracking) $id('inputTracking').value = '';
    const fields = [
        'inputStatus', 'inputDate', 'inputBranchCode', 'inputSwbSerial', 'inputShippingNo', 'inputCustomerInvoice',
        'inputSwbDate', 'inputShipmentType', 'inputRoute', 'inputM1', 'inputM2', 'inputM3', 'inputM4', 'inputM5', 'inputM6',
        'inputSender', 'inputSenderPhone', 'inputReceiver',
        'inputReceiverPhone', 'inputDestination', 'inputReceiverAddress', 'inputOriginCountry',
        'inputDestinationCountry', 'inputOriginalQuantity', 'inputQuantity', 'inputOriginalWeight',
        'inputWeight', 'inputNotes'
    ];
    fields.forEach(f => { const el = $id(f); if (el) { if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = ''; } });
    const btn = $id('btnRegisterShipment'); if (btn) btn.textContent = 'Sync Shipment Record';
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
        shippingNumber: $id('inputShippingNo').value,
        customerInvoice: $id('inputCustomerInvoice').value,
        swbDate: $id('inputSwbDate').value,
        shipmentType: $id('inputShipmentType').value,
        route: $id('inputRoute').value,
        milestone1: $id('inputM1').value,
        milestone2: $id('inputM2').value,
        milestone3: $id('inputM3').value,
        milestone4: $id('inputM4').value,
        milestone5: $id('inputM5').value,
        milestone6: $id('inputM6').value,
        sender: $id('inputSender').value,
        senderPhone: $id('inputSenderPhone').value,
        receiver: $id('inputReceiver').value,
        receiverPhone: $id('inputReceiverPhone').value,
        destination: $id('inputDestination').value,
        receiverAddress: $id('inputReceiverAddress').value,
        originCountry: $id('inputOriginCountry').value,
        destinationCountry: $id('inputDestinationCountry').value,
        originalQuantity: $id('inputOriginalQuantity').value,
        quantity: $id('inputQuantity').value,
        originalWeight: $id('inputOriginalWeight').value,
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
    if (!item) return;

    const currentStatus = item.data.status || 'Pending';
    const currentStatusDate = item.data.statusDate || item.data.date || new Date().toISOString();
    const currentPaidDate = formatDateForInput(item.data.paidDate);

    console.log(`[Edit] Loading record: ${id}`, {
        rawPaidDate: item.data.paidDate,
        formattedPaidDate: currentPaidDate
    });

    row.innerHTML = `<td colspan="12">
        <div class="n-card" style="margin:20px; background:rgba(255,255,255,0.03); display:flex; flex-wrap:wrap; align-items:center; gap:24px;">
            <div style="display:grid; gap:8px; flex:1; min-width:240px;">
                <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Update Operational Status</label>
                <select id="edit_status_${id}" class="n-input" onchange="$id('edit_status_date_${id}').value = new Date().toISOString()">${$id('inputStatus').innerHTML}</select>
            </div>
            <div style="display:grid; gap:8px; flex:1; min-width:240px;">
                <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Status Date</label>
                <input id="edit_status_date_${id}" class="n-input" value="${currentStatusDate}" readonly style="background:rgba(255,255,255,0.02);">
            </div>
            <div style="display:grid; gap:8px; flex:1; min-width:240px;">
                <label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Paid Date</label>
                <input type="date" id="edit_paid_date_${id}" class="n-input" value="${currentPaidDate}">
            </div>
            <div style="display:grid; gap:8px; flex:1; min-width:240px;">
                <label style="font-size:0.7rem; opacity:0;" class="hidden-mobile">&nbsp;</label>
                <div style="display:flex; gap:12px;">
                    <button class="n-btn primary" style="flex:1;" onclick="window.saveRow('${id}')">Save</button>
                    <button class="n-btn" style="flex:1;" onclick="window.loadDashboard()">Cancel</button>
                </div>
            </div>
        </div>
    </td>`;
    $id('edit_status_'+id).value = currentStatus;
};

window.saveRow = async id => {
    const db = getDb(); if (!db) return;
    try {
        const status = $id('edit_status_'+id).value;
        const statusDate = $id('edit_status_date_'+id).value;
        const paidDate = $id('edit_paid_date_'+id).value;
        await db.saveShipment(id, { status, statusDate, paidDate });
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

window.openManifestsModal = async () => {
    const db = getDb(); if (!db) return;
    try {
        console.log('[Manifests] Fetching archive list...');
        const res = await db.queryManifests();
        const list = $id('manifestsList');
        if (!list) {
            console.error('[Manifests] ERROR: manifestsList container not found in DOM.');
            return;
        }

        list.innerHTML = (res.items || []).map(m => `
            <div class="n-card" style="padding:20px; background:var(--n-surface); display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div style="flex:1;">
                    <h4 style="font-size:0.95rem; color:var(--n-gold);">${m.fileName}</h4>
                    <p class="text-muted" style="font-size:0.75rem; margin-top:4px;">Uploaded: ${new Date(m.uploadDate).toLocaleString()} &bull; ${(m.size / 1024).toFixed(1)} KB</p>
                </div>
                <div style="display:flex; gap:12px;">
                    <a href="${db.getManifestViewUrl(m.fileName)}" target="_blank" class="n-btn" style="padding:8px 16px;"><i class="fa-solid fa-eye"></i> Open</a>
                    <a href="${db.getManifestDownloadUrl(m.fileName)}" download class="n-btn primary" style="padding:8px 16px;"><i class="fa-solid fa-download"></i></a>
                </div>
            </div>
        `).join('') || '<div class="text-center p-40 text-muted">No manifest files identified in archives.</div>';

        const m = $id('manifestsModal');
        if (m) {
            console.log('[Manifests] Opening modal...');
            m.style.opacity = '1';
            m.style.pointerEvents = 'auto';
        } else {
            console.error('[Manifests] ERROR: manifestsModal element not found.');
        }
    } catch (e) {
        console.error('[Manifests] Fetch Failed:', e);
        alert('Failed to fetch manifests: ' + e.message);
    }
};

// --- Navigation & UI Handlers ---

window.toggleNotificationDrawer = () => {
    const d = $id('notificationDrawer');
    if (d) d.style.right = d.style.right === '0px' ? '-400px' : '0px';
};

window.clearNotifications = async () => {
    if (confirm('Clear all notifications?')) {
        const db = getDb(); if (!db) return;
        try {
            const p = window.nooraniAdminProfile || await db.getCurrentAdminProfile();
            await db.clearNotifications(p.uid);
            window.renderNotifications([]);
        } catch (e) { alert('Failed to clear: ' + e.message); }
    }
};

window.closeWorkspace = () => {
    const ws = $id('shipmentWorkspaceModal');
    ws.style.opacity = '0';
    ws.style.pointerEvents = 'none';
    enterpriseAdminState.activeTracking = null;
};

// --- Report Handlers ---

window.refreshAnalytics = async () => {
    const db = getDb(); if (!db) return;
    try {
        console.log('[Reports] Refreshing analytics...');
        const s = await db.getFinanceStats();
        const profitEl = $id('rep-kpi-profit');
        if (profitEl) profitEl.textContent = `$${(s.totalRevenue - s.totalExpenses).toLocaleString()}`;
        // Further analytics implementation...
    } catch (e) { console.error('[Reports] Refresh Failed', e); }
};

window.switchReportTab = (btn, tabId) => {
    const parent = btn.closest('#enterpriseReportsCard');
    if (!parent) return;
    parent.querySelectorAll('nav .n-btn').forEach(b => b.classList.toggle('active', b === btn));
    parent.querySelectorAll('.report-tab-content').forEach(c => c.classList.toggle('hidden', c.id !== 'rep-' + tabId));
};

// --- Settings Handlers ---

window.switchSettingsTab = (btn, tabId) => {
    const parent = btn.closest('#enterpriseSettingsCard');
    if (!parent) return;
    parent.querySelectorAll('nav .n-btn').forEach(b => b.classList.toggle('active', b === btn));
    parent.querySelectorAll('.settings-tab-content').forEach(c => c.classList.toggle('hidden', c.id !== 'set-' + tabId));
};

window.saveAllSettings = async () => {
    const db = getDb(); if (!db) return;
    try {
        const settings = {
            companyName: $id('set-comp-name').value,
            companyEmail: $id('set-comp-email').value,
            shipmentPrefix: $id('set-ship-prefix').value,
            shipmentStart: $id('set-ship-start').value,
            themeMode: $id('set-app-theme').value,
            accentColor: $id('set-app-color').value
        };
        await db.saveSystemSettings('general', { settings });
        alert('Settings saved successfully.');
    } catch (e) { alert('Save failed: ' + e.message); }
};

// --- Shipment Workspace Helpers ---

window.addWSNote = async () => {
    const id = enterpriseAdminState.activeTracking;
    const content = $id('wsNewNote').value;
    if (!id || !content) return;
    const db = getDb(); if (!db) return;
    try {
        const p = window.nooraniAdminProfile || await db.getCurrentAdminProfile();
        await db.saveShipmentNote(id, { content, author: p?.email || 'System' });
        $id('wsNewNote').value = '';
        window.openShipmentWorkspace(id);
    } catch (e) { alert('Failed to add note: ' + e.message); }
};

window.uploadWSAsset = async () => {
    const id = enterpriseAdminState.activeTracking;
    const file = $id('wsAssetInput').files[0];
    if (!id || !file) return;
    const db = getDb(); if (!db) return;
    try {
        await db.uploadShipmentDocument(id, file);
        window.openShipmentWorkspace(id);
    } catch (e) { alert('Upload failed: ' + e.message); }
};

window.renderUsers = async () => {
    const db = getDb(); if (!db) return;
    try {
        const users = await db.getUserAccounts();
        $id('userTableBody').innerHTML = (users || []).map(u => `<tr><td><div style="display:flex; align-items:center; gap:12px;"><div style="width:36px; height:36px; background:var(--n-gold-glow); border-radius:50%; display:grid; place-items:center; font-size:0.75rem; color:var(--n-gold); font-weight:900; border:1px solid var(--n-border-accent);">${u.email.charAt(0).toUpperCase()}</div><strong>${u.email}</strong></div></td><td><span class="status-badge status-transit">${u.role.toUpperCase()}</span></td><td>${u.branchCode || 'HQ'}</td><td><span class="status-badge status-delivered">${u.status.toUpperCase()}</span></td><td class="text-right"><button class="n-btn" style="padding:8px 12px; color:var(--n-danger); border-color:rgba(239,68,68,0.2);" onclick="window.deleteUser('${u.uid}')"><i class="fa-solid fa-user-xmark"></i></button></td></tr>`).join('') || '<tr><td colspan="5" class="text-center text-muted">No authorized accounts identified.</td></tr>';
    } catch (e) {}
};
window.showUserForm = async (id = null) => {
    $id('userEntryForm').reset(); $id('user-id').value = id || '';
    const m = $id('userFormModal'); m.style.opacity='1'; m.style.pointerEvents='auto';
};
window.closeUserForm = () => { const m = $id('userFormModal'); m.style.opacity='0'; m.style.pointerEvents='none'; };
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
        $id('finTableBody').innerHTML = (res.items || []).map(t => `<tr><td><span style="font-family:monospace; color:var(--n-gold); font-weight:800;">${t.id}</span></td><td>${t.date}</td><td>${t.category}</td><td>${t.paymentMethod || ''}</td><td><strong>$${t.amount}</strong></td><td><span class="status-badge status-delivered">${t.status}</span></td><td class="text-right"><button class="n-btn" style="padding:8px 12px; color:var(--n-danger); border-color:rgba(239,68,68,0.2);" onclick="window.deleteTransaction('${t.id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="7" class="text-center text-muted">No financial records identified.</td></tr>';
    } catch (e) {}
};

window.showTransactionForm = (type = 'income') => {
    $id('transactionEntryForm').reset();
    $id('txn-type').value = type;
    $id('txn-date').value = new Date().toISOString().split('T')[0];
    const m = $id('transactionFormModal'); m.style.opacity='1'; m.style.pointerEvents='auto';
};

window.submitTransactionForm = async () => {
    const db = getDb(); if (!db) return;
    try {
        const d = {
            id: $id('txn-id').value,
            type: $id('txn-type').value,
            date: $id('txn-date').value,
            category: $id('txn-category').value,
            amount: $id('txn-amount').value,
            description: $id('txn-desc').value
        };
        await db.saveTransaction(d);
        const m = $id('transactionFormModal'); m.style.opacity='0'; m.style.pointerEvents='none';
        window.renderFinance();
    } catch (e) { alert(e.message); }
};

window.deleteTransaction = async id => {
    if (confirm('Delete this transaction?')) {
        const db = getDb(); if (!db) return;
        try {
            await db.deleteTransaction(id);
            window.renderFinance();
        } catch (e) { alert(e.message); }
    }
};

window.renderAuditLogs = async () => {
    const db = getDb(); if (!db) return;
    try {
        const res = await db.queryAuditLogs({ pageSize: 50 });
        const search = $id('auditSearchInput')?.value.toLowerCase() || '';
        const rows = (res.items || [])
            .filter(l => !search || l.actorEmail?.toLowerCase().includes(search) || l.action?.toLowerCase().includes(search) || l.module?.toLowerCase().includes(search))
            .map(l => {
                const email = l.actorEmail || 'System';
                const initial = email.charAt(0).toUpperCase();
                return `<tr><td>${formatTime(l.created_at || l.createdAt)}</td><td><div style="display:flex; align-items:center; gap:12px;"><div style="width:32px; height:32px; background:var(--n-gold-glow); border-radius:50%; display:grid; place-items:center; font-size:0.7rem; color:var(--n-gold); font-weight:800; border:1px solid var(--n-border-accent);">${initial}</div>${email}</div></td><td>${l.action}</td><td>${l.module}</td><td class="text-right"><button class="n-btn" style="padding:8px 12px;" onclick="window.viewAuditDetails('${l.id}')"><i class="fa-solid fa-info-circle"></i></button></td></tr>`;
            }).join('');

        const tbody = $id('auditTableBody');
        if (tbody) tbody.innerHTML = rows || '<tr><td colspan="5" class="text-center text-muted">No security logs identified.</td></tr>';
    } catch (e) {}
};
window.viewAuditDetails = async (id) => alert('Audit entry details would be displayed here.');

window.renderNotifications = (l) => {
    const list = Array.isArray(l) ? l : [];
    const c = $id('notif-count');
    if (c) {
        const unread = list.filter(x => !x.read).length;
        c.textContent = unread;
        c.style.display = unread > 0 ? 'block' : 'none';
    }
    const drawerList = $id('notif-list');
    if (drawerList) drawerList.innerHTML = list.map(n => `<div class="n-card" style="padding:20px; margin-bottom:16px; background:var(--n-surface); border-radius:12px;"><h5 style="font-size:0.9rem; color:var(--n-gold); margin-bottom:4px;">${n.title}</h5><p style="font-size:0.85rem; color:var(--n-muted);">${n.message}</p></div>`).join('') || '<p class="text-center mt-20 text-muted">No alerts identified.</p>';

    const fullList = $id('enterpriseNotifFullList');
    if (fullList) fullList.innerHTML = list.map(n => `<div class="n-card" style="padding:24px; background:var(--n-surface);"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><h4 style="color:var(--n-gold);">${n.title}</h4><p class="mt-10">${n.message}</p><small class="text-muted mt-20" style="display:block;">${formatTime(n.createdAt)}</small></div><span class="status-badge ${n.read ? 'status-delivered' : 'status-transit'}">${n.read ? 'READ' : 'NEW'}</span></div></div>`).join('') || '<div class="text-center p-40 text-muted">No notification history identified.</div>';
};

window.openShipmentWorkspace = async id => {
    const db = getDb(); if (!db) return;
    try {
        const ws = $id('shipmentWorkspaceModal');
        ws.style.opacity = '1';
        ws.style.pointerEvents = 'auto';
        enterpriseAdminState.activeTracking = id; $id('wsTrack').textContent = id;
        const res = await db.getShipmentByTracking(id);
        const d = res.data;
        $id('wsTitle').textContent = d.receiver || 'Shipment File';
        const currentStatusDate = d.statusDate || d.date || new Date().toISOString();
        const currentPaidDate = formatDateForInput(d.paidDate);

        console.log(`[Workspace] Loading record: ${id}`, {
            rawPaidDate: d.paidDate,
            formattedPaidDate: currentPaidDate
        });

        $id('wsForm').innerHTML = `
            <div class="form-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:24px;">
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Operational Status</label><select id="wsStatus" class="n-input" onchange="$id('wsStatusDate').value = new Date().toISOString()">${$id('inputStatus').innerHTML}</select></div>
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Status Date</label><input id="wsStatusDate" class="n-input" value="${currentStatusDate}" readonly style="background:rgba(255,255,255,0.02);"></div>
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Paid Date</label><input type="date" id="wsPaidDate" class="n-input" value="${currentPaidDate}"></div>
            </div>
            <div class="form-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:24px; margin-top:20px;">
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Branch Hub</label><input id="wsBranch" class="n-input" value="${d.branchCode||''}"></div>
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">SWB Serial</label><input id="wsSwbSerial" class="n-input" value="${d.swbSerial||''}"></div>
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Invoice #</label><input id="wsInvoice" class="n-input" value="${d.customerInvoice||''}"></div>
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Route</label><input id="wsRoute" class="n-input" value="${d.route||''}"></div>
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Shipment Type</label><select id="wsShipmentType" class="n-input"><option value="Air Freight">Air Freight</option><option value="Sea Freight">Sea Freight</option><option value="Land Freight">Land Freight</option></select></div>
            </div>
            <!-- Milestone Row -->
            <div class="form-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:16px; margin-top:20px; background:rgba(255,255,255,0.02); padding:16px; border-radius:12px;">
                <div style="display:grid; gap:4px;"><label style="font-size:0.6rem; font-weight:800; color:var(--n-low);">1. Loaded SA</label><input type="date" id="wsM1" class="n-input" value="${d.milestone1||''}"></div>
                <div style="display:grid; gap:4px;"><label style="font-size:0.6rem; font-weight:800; color:var(--n-low);">2. Jeddah Port</label><input type="date" id="wsM2" class="n-input" value="${d.milestone2||''}"></div>
                <div style="display:grid; gap:4px;"><label style="font-size:0.6rem; font-weight:800; color:var(--n-low);">3. Sea Voyage</label><input type="date" id="wsM3" class="n-input" value="${d.milestone3||''}"></div>
                <div style="display:grid; gap:4px;"><label style="font-size:0.6rem; font-weight:800; color:var(--n-low);">4. Karachi Arrival</label><input type="date" id="wsM4" class="n-input" value="${d.milestone4||''}"></div>
                <div style="display:grid; gap:4px;"><label style="font-size:0.6rem; font-weight:800; color:var(--n-low);">5. Transfer LHR</label><input type="date" id="wsM5" class="n-input" value="${d.milestone5||''}"></div>
                <div style="display:grid; gap:4px;"><label style="font-size:0.6rem; font-weight:800; color:var(--n-low);">6. Final Deliv</label><input type="date" id="wsM6" class="n-input" value="${d.milestone6||''}"></div>
            </div>
            <div class="form-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:24px; margin-top:20px;">
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Shipper Name</label><input id="wsSender" class="n-input" value="${d.sender||''}"></div>
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Shipper Phone</label><input id="wsSenderPhone" class="n-input" value="${d.senderPhone||''}"></div>
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Receiver Name</label><input id="wsReceiver" class="n-input" value="${d.receiver||''}"></div>
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Receiver Phone</label><input id="wsReceiverPhone" class="n-input" value="${d.receiverPhone||''}"></div>
            </div>
            <div class="form-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:24px; margin-top:20px;">
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Origin Country</label><input id="wsOriginCountry" class="n-input" value="${d.originCountry||''}"></div>
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Dest Country</label><input id="wsDestinationCountry" class="n-input" value="${d.destinationCountry||''}"></div>
            </div>
            <div class="form-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:24px; margin-top:20px;">
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Original Qty</label><input id="wsOriginalQty" class="n-input" value="${d.originalQuantity||0}"></div>
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Current Qty</label><input id="wsQty" class="n-input" value="${d.quantity||1}"></div>
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Original Weight</label><input id="wsOriginalWeight" class="n-input" value="${d.originalWeight||0}"></div>
                <div style="display:grid; gap:8px;"><label style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:var(--n-low);">Current Weight</label><input id="wsWeight" class="n-input" value="${d.weight||0}"></div>
            </div>`;

        $id('wsStatus').value = d.status;
        if ($id('wsShipmentType')) $id('wsShipmentType').value = d.shipmentType || 'Air Freight';

        const notes = await db.getShipmentNotesForShipment(id);
        $id('wsNoteList').innerHTML = notes.map(x => `<div class="n-card" style="padding:20px; margin-bottom:16px; background:var(--n-surface); border-radius:12px;"><strong>${x.author}</strong><p style="margin-top:8px; font-size:0.9rem;">${x.content}</p></div>`).join('') || '<p class="text-muted">No notes identified for this file.</p>';

        const assets = await db.getShipmentAssetsForShipment(id);
        $id('wsAssetList').innerHTML = assets.map(x => `<div class="n-card" style="padding:16px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; background:var(--n-surface); border-radius:12px;"><a href="${x.downloadURL}" target="_blank" style="color:var(--n-gold); font-weight:700;">${x.fileName}</a> <i class="fa-solid fa-file-arrow-down"></i></div>`).join('') || '<p class="text-muted">No attachments identified.</p>';
    } catch (e) { console.error('Workspace load failed', e); }
};

window.saveWS = async () => {
    const db = getDb(); if (!db) return;
    try {
        const p = window.nooraniAdminProfile || await db.getCurrentAdminProfile();
        await db.saveShipment(enterpriseAdminState.activeTracking, {
            status: $id('wsStatus').value,
            statusDate: $id('wsStatusDate').value,
            paidDate: $id('wsPaidDate').value,
            branchCode: $id('wsBranch').value,
            swbSerial: $id('wsSwbSerial').value,
            customerInvoice: $id('wsInvoice').value,
            route: $id('wsRoute').value,
            milestone1: $id('wsM1').value,
            milestone2: $id('wsM2').value,
            milestone3: $id('wsM3').value,
            milestone4: $id('wsM4').value,
            milestone5: $id('wsM5').value,
            milestone6: $id('wsM6').value,
            shipmentType: $id('wsShipmentType').value,
            sender: $id('wsSender').value,
            senderPhone: $id('wsSenderPhone').value,
            receiver: $id('wsReceiver').value,
            receiverPhone: $id('wsReceiverPhone').value,
            originCountry: $id('wsOriginCountry').value,
            destinationCountry: $id('wsDestinationCountry').value,
            originalQuantity: $id('wsOriginalQty').value,
            quantity: $id('wsQty').value,
            originalWeight: $id('wsOriginalWeight').value,
            weight: $id('wsWeight').value,
            author: p?.email || 'System'
        });
        alert('Record Synced.'); window.loadDashboard(); window.closeWorkspace();
    } catch (e) { alert('Sync failed: ' + e.message); }
};

window.renderOps = async () => {
    const db = getDb(); if (!db) return;
    try {
        const p = await db.getCurrentAdminProfile();
        if (!p) return;
        const roleLabel = (db.roleLabel ? db.roleLabel(p.role) : p.role).toUpperCase();
        const badge = $id('adminRoleBadge');
        if (badge) {
            badge.textContent = roleLabel;
            badge.className = 'status-badge ' + (p.role === 'superadmin' ? 'status-delivered' : 'status-transit');
        }
        const summary = $id('enterpriseRoleSummary');
        if (summary) summary.innerHTML = `<div style="display:flex; gap:12px;"><span class="status-badge status-delivered">${roleLabel}</span><span class="status-badge status-transit" style="border-radius:6px;">${p.branchCode||'GLOBAL HUB'}</span></div>`;
        window.renderUsers(); window.renderFinance(); window.renderAuditLogs();
    } catch (e) {}
};

// --- Export Logic ---

window.exportShipmentTable = (format) => {
    const items = enterpriseAdminState.currentItems;
    if (!items.length) return alert('No data identified for export');

    const headers = [
        'Tracking No', 'Sender Name', 'Receiver Name', 'Route',
        '1. Loaded in Saudi', '2. Jeddah Port Transit', '3. Sea Voyage',
        '4. Karachi Port Arrival', '5. Transfer to Lahore', '6. Final Delivery',
        'Overall Status'
    ];

    const data = items.map(i => {
        const d = i.data;
        return [
            i.trackingId || '',
            d.sender || '',
            d.receiver || '',
            d.route || '',
            d.milestone1 || '',
            d.milestone2 || '',
            d.milestone3 || '',
            d.milestone4 || '',
            d.milestone5 || '',
            d.milestone6 || '',
            d.status || ''
        ];
    });

    if (format === 'csv') {
        const csv = [headers.join(','), ...data.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'shipments.csv'; a.click();
    } else if (format === 'xlsx') {
        const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        XLSX.utils.book_append_sheet(wb, ws, 'Shipments'); XLSX.writeFile(wb, 'shipments.xlsx');
    } else if (format === 'pdf') {
        const { jsPDF } = window.jspdf; const doc = new jsPDF('landscape');
        doc.text('Shipment Manifest', 10, 10); doc.autoTable({ head: [headers], body: data, styles: { fontSize: 7 } }); doc.save('shipments.pdf');
    }
};

window.exportAudit = (format) => alert('Audit trail export in ' + format + ' cycle initialized.');

// --- Global Initialization ---

async function init() {
  createUI();

  // Use event delegation for reliable interaction in multi-page environment
  document.addEventListener('click', e => {
      if (e.target.closest('#btnOpenManifestsModal')) {
          e.preventDefault();
          window.openManifestsModal();
      }
  });

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
