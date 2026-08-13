/**
 * Noorani Cargo Enterprise | Multi-Page SWB Engine
 */

(function () {
  'use strict';

  const pageConfigs = {
    'dashboard': { navKey: 'dashboard', title: 'Dashboard', showRegisterSwb: false, showDatabase: false, enterpriseCards: [] },
    'create-swb': { navKey: 'create-swb', title: 'Shipment Registration', showRegisterSwb: true, showDatabase: false, enterpriseCards: [] },
    'swb-management': { navKey: 'swb-management', title: 'Shipment Management', showRegisterSwb: false, showDatabase: true, enterpriseCards: [] },
    'manifests': { navKey: 'manifests', title: 'Manifest & Containers', showRegisterSwb: false, showDatabase: false, enterpriseCards: ['manifestSection'] },
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
        <span class="text-gold" style="text-transform:uppercase; letter-spacing:2px; font-weight:800; font-size:0.75rem;">Command Center</span>
        <h1 style="font-size:2.5rem; color:#fff; margin-top:8px; letter-spacing:-1px;">Network Intelligence</h1>
        <p class="text-muted" style="margin-top:12px; font-size:1.1rem;">Enterprise orchestration of Sea Waybills and global supply chain records.</p>
        <div style="margin-top:32px; display:flex; gap:16px;">
          <button class="n-btn primary" onclick="window.location.search='?page=create-swb'"><i class="fa-solid fa-plus-circle"></i> NEW SHIPMENT</button>
          <button class="n-btn" onclick="window.refreshDashboard()"><i class="fa-solid fa-rotate"></i> REFRESH STREAM</button>
        </div>
      </section>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:20px; margin-bottom:24px;">
        <article class="kpi-card n-card" style="padding:20px !important;">
            <div style="color:var(--n-gold); font-size:1.5rem;"><i class="fa-solid fa-boxes-stacked"></i></div>
            <div style="margin-top:12px;">
                <span class="text-muted small block">MASTER SWB</span>
                <strong id="stat-total-swbs" style="font-size:1.8rem; color:#fff;">0</strong>
            </div>
        </article>
        <article class="kpi-card n-card" style="padding:20px !important;">
            <div style="color:#3498db; font-size:1.5rem;"><i class="fa-solid fa-hourglass-start"></i></div>
            <div style="margin-top:12px;">
                <span class="text-muted small block">PENDING</span>
                <strong id="stat-pending" style="font-size:1.8rem; color:#fff;">0</strong>
            </div>
        </article>
        <article class="kpi-card n-card" style="padding:20px !important;">
            <div style="color:var(--n-gold); font-size:1.5rem;"><i class="fa-solid fa-truck-fast"></i></div>
            <div style="margin-top:12px;">
                <span class="text-muted small block">IN TRANSIT</span>
                <strong id="stat-transit" style="font-size:1.8rem; color:#fff;">0</strong>
            </div>
        </article>
        <article class="kpi-card n-card" style="padding:20px !important;">
            <div style="color:#1abc9c; font-size:1.5rem;"><i class="fa-solid fa-warehouse"></i></div>
            <div style="margin-top:12px;">
                <span class="text-muted small block">ARRIVED</span>
                <strong id="stat-arrived" style="font-size:1.8rem; color:#fff;">0</strong>
            </div>
        </article>
        <article class="kpi-card n-card" style="padding:20px !important;">
            <div style="color:var(--n-success); font-size:1.5rem;"><i class="fa-solid fa-check-double"></i></div>
            <div style="margin-top:12px;">
                <span class="text-muted small block">DELIVERED</span>
                <strong id="stat-delivered" style="font-size:1.8rem; color:#fff;">0</strong>
            </div>
        </article>
      </div>

      <div style="display:grid; grid-template-columns: 1fr; gap:24px;">
        <article class="n-card" style="margin:0;">
            <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h3 style="font-size:1.1rem; color:#fff;"><i class="fa-solid fa-clock-rotate-left" style="color:var(--n-gold); margin-right:8px;"></i> Recent Global Activity</h3>
                <a href="?page=swb-management" class="text-gold" style="font-size:0.8rem; font-weight:700;">VIEW ALL SHIPMENTS</a>
            </header>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Serial No.</th>
                            <th>Customer</th>
                            <th>Current Status</th>
                            <th>Date</th>
                            <th class="text-right">Workspace</th>
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
