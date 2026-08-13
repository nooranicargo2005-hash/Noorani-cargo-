/**
 * Noorani Cargo Enterprise | Multi-Page SWB Engine
 */

(function () {
  'use strict';

  const pageConfigs = {
    'dashboard': { navKey: 'dashboard', title: 'Dashboard', showRegisterSwb: false, showDatabase: false, enterpriseCards: [] },
    'create-swb': { navKey: 'create-swb', title: 'SWB Registration', showRegisterSwb: true, showDatabase: false, enterpriseCards: [] },
    'swb-management': { navKey: 'swb-management', title: 'SWB Inventory', showRegisterSwb: false, showDatabase: true, enterpriseCards: [] },
    'user-management': { navKey: 'user-management', title: 'User Access', showRegisterSwb: false, showDatabase: false, enterpriseCards: ['enterpriseUsersCard'] }
  };

  function getPageName() {
    const p = new URLSearchParams(window.location.search).get('page');
    return (p && pageConfigs[p]) ? p : 'dashboard';
  }

  function $id(i) { return document.getElementById(i); }
  function setVisible(e, v) { if (e) { e.hidden = !v; e.style.display = v ? '' : 'none'; } }

  function ensureDashboardExperience() {
    let dashboard = $id('premiumDashboardExperience');
    const mainContent = $id('dashboardMainContent');
    if (dashboard || !mainContent) return dashboard;
    dashboard = document.createElement('section');
    dashboard.id = 'premiumDashboardExperience';
    dashboard.innerHTML = `
      <section class="dashboard-hero n-card">
        <span class="text-gold" style="text-transform:uppercase; letter-spacing:2px; font-weight:800; font-size:0.75rem;">Control Center</span>
        <h1 style="font-size:2.5rem; color:#fff; margin-top:8px; letter-spacing:-1px;">Operational Intelligence</h1>
        <p class="text-muted" style="margin-top:12px; font-size:1.1rem;">Real-time management of Sea Waybills and global cargo records.</p>
        <div style="margin-top:32px; display:flex; gap:16px;">
          <button class="n-btn primary" onclick="window.location.search='?page=create-swb'">REGISTER NEW SWB</button>
          <button class="n-btn" onclick="document.getElementById('inventoryImportFile').click()"><i class="fa-solid fa-file-import"></i> BULK IMPORT</button>
          <button class="n-btn" onclick="window.refreshDashboard()"><i class="fa-solid fa-rotate"></i> SYNC DASHBOARD</button>
        </div>
      </section>

      <div style="display:grid; grid-template-columns: 1fr 2fr; gap:24px; margin-top:24px;">
        <article class="kpi-card n-card" style="height:fit-content;">
            <div style="font-size:3rem; color:var(--n-gold);"><i class="fa-solid fa-file-invoice"></i></div>
            <div style="margin-top:16px;">
                <span class="text-muted" style="text-transform:uppercase; letter-spacing:1px; font-size:0.7rem; font-weight:800;">Master SWB Records</span>
                <strong id="stat-total-swbs" style="font-size:2.5rem; color:#fff; display:block; margin-top:8px;">0</strong>
            </div>
            <p class="text-muted" style="font-size:0.8rem; margin-top:16px; border-top:1px solid var(--n-border); padding-top:16px;">Total entries synchronized with Supabase cloud infrastructure.</p>
        </article>

        <article class="n-card">
            <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h3 style="font-size:1.1rem; color:#fff;"><i class="fa-solid fa-clock-rotate-left" style="color:var(--n-gold); margin-right:8px;"></i> Recent Activity</h3>
                <a href="?page=swb-management" class="text-gold" style="font-size:0.8rem; font-weight:700;">VIEW ALL</a>
            </header>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Serial No.</th>
                            <th>Customer</th>
                            <th>Consignee</th>
                            <th>Date</th>
                            <th class="text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody id="recentSwbTableBody">
                        <tr><td colspan="5" class="text-center py-20 text-muted">Loading activity stream...</td></tr>
                    </tbody>
                </table>
            </div>
        </article>
      </div>
    `;
    mainContent.appendChild(dashboard);
    return dashboard;
  }

  function buildEnterpriseStructure() {
    if ($id('enterpriseAppShell')) return;
    const header = $id('appHeader');
    const sidebar = $id('adminSidebar');
    const adminMain = document.querySelector('.admin-main');
    if (!header || !sidebar || !adminMain) return;

    const shell = document.createElement('div');
    shell.id = 'enterpriseAppShell';
    shell.className = 'enterprise-app';
    const side = document.createElement('aside');
    side.className = 'enterprise-side';
    const main = document.createElement('main');
    main.className = 'enterprise-main';

    document.body.innerHTML = '';
    document.body.appendChild(shell);
    shell.append(side, main);
    side.appendChild(sidebar);
    setVisible(sidebar, true);
    main.appendChild(header);
    main.appendChild(adminMain);
    setVisible(adminMain, true);

    applyLayout();
  }

  function applyLayout() {
    const name = getPageName();
    const config = pageConfigs[name];
    if (!config) return;

    document.title = `NOORANI CARGO — ${config.title}`;
    document.querySelectorAll('.sidebar .nav-item').forEach(i => {
        i.classList.toggle('active', i.dataset.navKey === config.navKey);
    });

    setVisible($id('dashboardMainContent'), true);
    setVisible($id('registerSwb'), config.showRegisterSwb);
    setVisible($id('databaseSection'), config.showDatabase);

    const dashboardExperience = name === 'dashboard' ? ensureDashboardExperience() : $id('premiumDashboardExperience');
    setVisible(dashboardExperience, name === 'dashboard');

    if (name === 'dashboard' && typeof window.refreshDashboard === 'function') window.refreshDashboard();
    else if (config.showDatabase && typeof window.loadDashboard === 'function') window.loadDashboard();
    else if (name === 'user-management' && typeof window.renderUsers === 'function') window.renderUsers();

    const cards = ['enterpriseUsersCard'];
    cards.forEach(id => { const c = $id(id); if (c) setVisible(c, config.enterpriseCards.includes(id)); });

    // Ensure scroll to top on page change
    const main = document.querySelector('.enterprise-main');
    if (main) main.scrollTop = 0;
  }

  function init() {
    window.addEventListener('popstate', applyLayout);

    document.addEventListener('click', e => {
      const link = e.target.closest('a');
      if (link && link.getAttribute('href') && link.getAttribute('href').startsWith('?page=')) {
        e.preventDefault();
        const url = link.getAttribute('href');
        if (window.location.search !== url) {
            history.pushState(null, '', url);
            applyLayout();
        }
      }
    });

    const timer = setInterval(() => {
      if ($id('adminView')) { clearInterval(timer); buildEnterpriseStructure(); }
    }, 50);
  }

  init();
})();
